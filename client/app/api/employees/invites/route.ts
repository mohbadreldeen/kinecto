import { and, asc, eq, gt, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { generateInviteToken, hashInviteToken } from "@/lib/auth/invite-token";
import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import { employeeInvites } from "@/lib/db/schema";

const inviteSchema = z.object({
    email: z.string().trim().email(),
    fullName: z.string().trim().min(2).max(120).optional(),
});

export async function GET() {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    if (tenantResult.context.role !== "owner") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const now = new Date();

    const rows = await db
        .select({
            id: employeeInvites.id,
            email: employeeInvites.email,
            fullName: employeeInvites.fullName,
            expiresAt: employeeInvites.expiresAt,
            acceptedAt: employeeInvites.acceptedAt,
            createdAt: employeeInvites.createdAt,
        })
        .from(employeeInvites)
        .where(eq(employeeInvites.tenantId, tenantResult.context.tenantId))
        .orderBy(asc(employeeInvites.createdAt));

    return NextResponse.json({
        data: rows.map((row) => ({
            ...row,
            isExpired: !row.acceptedAt && row.expiresAt < now,
        })),
    });
}

export async function POST(request: NextRequest) {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    if (tenantResult.context.role !== "owner") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const json = await request.json().catch(() => null);
    const parsed = inviteSchema.safeParse(json);

    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid payload", details: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const email = parsed.data.email.toLowerCase();

    const existingActiveInvite = await db.query.employeeInvites.findFirst({
        where: and(
            eq(employeeInvites.tenantId, tenantResult.context.tenantId),
            eq(employeeInvites.email, email),
            isNull(employeeInvites.acceptedAt),
            gt(employeeInvites.expiresAt, new Date())
        ),
    });

    if (existingActiveInvite) {
        return NextResponse.json(
            { error: "An active invite already exists for this email" },
            { status: 409 }
        );
    }

    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const [created] = await db
        .insert(employeeInvites)
        .values({
            tenantId: tenantResult.context.tenantId,
            email,
            fullName: parsed.data.fullName,
            tokenHash,
            invitedByAuthUserId: tenantResult.context.authUserId,
            expiresAt,
        })
        .returning({
            id: employeeInvites.id,
            email: employeeInvites.email,
            fullName: employeeInvites.fullName,
            expiresAt: employeeInvites.expiresAt,
            createdAt: employeeInvites.createdAt,
        });

    const origin = request.nextUrl.origin;

    return NextResponse.json(
        {
            data: created,
            inviteUrl: `${origin}/accept-invite?token=${token}`,
        },
        { status: 201 }
    );
}
