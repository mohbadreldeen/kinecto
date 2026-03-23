import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { customers, tenants, users } from "@/lib/db/schema";

let mockUser: {
    id: string;
    app_metadata?: { tenantId?: string };
} | null = null;

vi.mock("@/lib/supabase/server", () => ({
    createClient: async () => ({
        auth: {
            getUser: async () => ({
                data: { user: mockUser },
                error: mockUser ? null : new Error("Unauthorized"),
            }),
        },
    }),
}));

import { GET } from "./route";

const createdTenantIds = new Set<string>();

async function createTenantOwner(input: { tenantName: string }) {
    const authUserId = randomUUID();
    const slug = `test-${input.tenantName.toLowerCase()}-${randomUUID().slice(0, 8)}`;

    const [tenant] = await db
        .insert(tenants)
        .values({
            name: input.tenantName,
            slug,
            settings: {},
            brandColors: {},
        })
        .returning({ id: tenants.id });

    createdTenantIds.add(tenant.id);

    await db.insert(users).values({
        tenantId: tenant.id,
        authUserId,
        email: `${slug}@example.test`,
        fullName: `${input.tenantName} Owner`,
        role: "owner",
        status: "active",
    });

    return {
        tenantId: tenant.id,
        authUserId,
    };
}

beforeEach(() => {
    mockUser = null;
});

afterEach(async () => {
    if (createdTenantIds.size === 0) return;

    for (const tenantId of createdTenantIds) {
        await db.delete(customers).where(eq(customers.tenantId, tenantId));
        await db.delete(users).where(eq(users.tenantId, tenantId));
        await db.delete(tenants).where(eq(tenants.id, tenantId));
    }

    createdTenantIds.clear();
});

describe("/api/campaigns/audience-preview", () => {
    it("returns selected customer previews", async () => {
        const tenant = await createTenantOwner({
            tenantName: "Tenant Audience",
        });

        const [customerA, customerB] = await db
            .insert(customers)
            .values([
                {
                    tenantId: tenant.tenantId,
                    name: "Audience A",
                    phone: "+201011122233",
                    status: "active",
                },
                {
                    tenantId: tenant.tenantId,
                    name: "Audience B",
                    phone: "+201011122244",
                    status: "active",
                },
            ])
            .returning({ id: customers.id });

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest(
            `http://localhost:3000/api/campaigns/audience-preview?selectedIds=${customerA.id}&selectedIds=${customerB.id}`,
            {
                method: "GET",
            }
        );

        const response = await GET(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data).toHaveLength(2);
        expect(body.data.map((item: { name: string }) => item.name)).toContain(
            "Audience A"
        );
    });
});
