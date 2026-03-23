import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { tenants, users } from "@/lib/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils/slugify";

const signupSchema = z.object({
    businessName: z.string().trim().min(2).max(120),
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
    password: z.string().min(8).max(128),
});

async function createUniqueSlug(businessName: string) {
    const baseSlug =
        slugify(businessName) || `tenant-${randomUUID().slice(0, 8)}`;

    const existing = await db.query.tenants.findFirst({
        where: eq(tenants.slug, baseSlug),
    });

    if (!existing) {
        return baseSlug;
    }

    return `${baseSlug}-${randomUUID().slice(0, 8)}`;
}

export async function POST(request: NextRequest) {
    const json = await request.json().catch(() => null);
    const parsed = signupSchema.safeParse(json);

    if (!parsed.success) {
        return NextResponse.json(
            {
                error: "Invalid signup payload",
                details: parsed.error.flatten(),
            },
            { status: 400 }
        );
    }

    const { businessName, fullName, email, password } = parsed.data;
    const admin = createAdminClient();

    let tenantId: string | null = null;
    let authUserId: string | null = null;

    try {
        const slug = await createUniqueSlug(businessName);

        const [tenant] = await db
            .insert(tenants)
            .values({
                name: businessName,
                slug,
                settings: { locale: "en" },
                brandColors: {},
            })
            .returning({
                id: tenants.id,
                name: tenants.name,
                slug: tenants.slug,
            });

        tenantId = tenant.id;

        const { data, error } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { fullName },
            app_metadata: {
                tenantId: tenant.id,
                role: "owner",
            },
        });

        if (error || !data.user) {
            throw error ?? new Error("Failed to create auth user");
        }

        authUserId = data.user.id;

        await db.insert(users).values({
            tenantId: tenant.id,
            authUserId: data.user.id,
            email,
            fullName,
            role: "owner",
            status: "active",
        });

        return NextResponse.json(
            {
                data: {
                    tenantId: tenant.id,
                    tenantName: tenant.name,
                    email,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        if (authUserId) {
            await admin.auth.admin
                .deleteUser(authUserId)
                .catch(() => undefined);
        }

        if (tenantId) {
            await db
                .delete(tenants)
                .where(eq(tenants.id, tenantId))
                .catch(() => undefined);
        }

        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Signup failed",
            },
            { status: 500 }
        );
    }
}
