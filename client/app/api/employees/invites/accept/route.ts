import { and, eq, gt, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hashInviteToken } from "@/lib/auth/invite-token";
import { db } from "@/lib/db";
import { employeeInvites, users } from "@/lib/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";

const acceptInviteSchema = z.object({
    token: z.string().min(20),
    fullName: z.string().trim().min(2).max(120),
    password: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
    const json = await request.json().catch(() => null);
    const parsed = acceptInviteSchema.safeParse(json);

    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid payload", details: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const tokenHash = hashInviteToken(parsed.data.token);

    const invite = await db.query.employeeInvites.findFirst({
        where: and(
            eq(employeeInvites.tokenHash, tokenHash),
            isNull(employeeInvites.acceptedAt),
            gt(employeeInvites.expiresAt, new Date())
        ),
    });

    if (!invite) {
        return NextResponse.json(
            { error: "Invitation is invalid or expired" },
            { status: 404 }
        );
    }

    const admin = createAdminClient();

    let authUserId: string | null = null;

    try {
        const { data, error } = await admin.auth.admin.createUser({
            email: invite.email,
            password: parsed.data.password,
            email_confirm: true,
            user_metadata: { fullName: parsed.data.fullName },
            app_metadata: {
                tenantId: invite.tenantId,
                role: "employee",
            },
        });

        if (error || !data.user) {
            throw error ?? new Error("Could not create employee auth user");
        }

        authUserId = data.user.id;

        await db.insert(users).values({
            tenantId: invite.tenantId,
            authUserId,
            email: invite.email,
            fullName: parsed.data.fullName,
            role: "employee",
            status: "active",
        });

        await db
            .update(employeeInvites)
            .set({
                acceptedAt: new Date(),
                acceptedByAuthUserId: authUserId,
                updatedAt: new Date(),
            })
            .where(eq(employeeInvites.id, invite.id));

        return NextResponse.json({
            data: {
                email: invite.email,
                tenantId: invite.tenantId,
            },
        });
    } catch (error) {
        if (authUserId) {
            await admin.auth.admin
                .deleteUser(authUserId)
                .catch(() => undefined);
        }

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Could not accept invitation",
            },
            { status: 500 }
        );
    }
}
