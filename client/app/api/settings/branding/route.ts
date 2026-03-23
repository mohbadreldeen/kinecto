import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import { tenants } from "@/lib/db/schema";

const hexColorSchema = z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color (e.g. #1a2b3c)");

const patchSchema = z.object({
    logoUrl: z.string().url().nullable().optional(),
    brandColors: z
        .object({
            primary: hexColorSchema.optional(),
            accent: hexColorSchema.optional(),
        })
        .optional(),
});

export async function GET() {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    const { tenantId } = tenantResult.context;

    const [tenant] = await db
        .select({
            logoUrl: tenants.logoUrl,
            brandColors: tenants.brandColors,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

    if (!tenant) {
        return NextResponse.json(
            { error: "Tenant not found" },
            { status: 404 }
        );
    }

    return NextResponse.json({ data: tenant });
}

export async function PATCH(request: NextRequest) {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    if (tenantResult.context.role !== "owner") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { tenantId } = tenantResult.context;

    const body = await request.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid payload", details: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const updates: Partial<{
        logoUrl: string | null;
        brandColors: Record<string, string>;
        updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (parsed.data.logoUrl !== undefined) {
        updates.logoUrl = parsed.data.logoUrl;
    }

    if (parsed.data.brandColors) {
        const [existing] = await db
            .select({ brandColors: tenants.brandColors })
            .from(tenants)
            .where(eq(tenants.id, tenantId))
            .limit(1);

        updates.brandColors = {
            ...(existing?.brandColors ?? {}),
            ...parsed.data.brandColors,
        };
    }

    const [updated] = await db
        .update(tenants)
        .set(updates)
        .where(eq(tenants.id, tenantId))
        .returning({
            logoUrl: tenants.logoUrl,
            brandColors: tenants.brandColors,
        });

    return NextResponse.json({ data: updated });
}
