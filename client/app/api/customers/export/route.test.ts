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

describe("/api/customers/export GET", () => {
    it("exports filtered customers as csv", async () => {
        const tenant = await createTenantOwner({ tenantName: "Tenant Export" });

        await db.insert(customers).values([
            {
                tenantId: tenant.tenantId,
                name: "VIP One",
                phone: "+201077700001",
                tags: ["vip"],
                pointsBalance: 200,
                status: "active",
            },
            {
                tenantId: tenant.tenantId,
                name: "Regular One",
                phone: "+201077700002",
                tags: ["regular"],
                pointsBalance: 30,
                status: "active",
            },
        ]);

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest(
            "http://localhost:3000/api/customers/export?tag=vip&minPoints=100",
            {
                method: "GET",
            }
        );

        const response = await GET(request);
        const csv = await response.text();

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("text/csv");
        expect(csv).toContain(
            "id,name,phone,email,pointsBalance,status,tags,lastVisitAt,createdAt"
        );
        expect(csv).toContain("VIP One");
        expect(csv).not.toContain("Regular One");
    });

    it("exports only selected IDs when provided", async () => {
        const tenant = await createTenantOwner({
            tenantName: "Tenant Export Selected",
        });

        const [first, second] = await db
            .insert(customers)
            .values([
                {
                    tenantId: tenant.tenantId,
                    name: "Selected Customer",
                    phone: "+201088800001",
                    pointsBalance: 10,
                    status: "active",
                },
                {
                    tenantId: tenant.tenantId,
                    name: "Unselected Customer",
                    phone: "+201088800002",
                    pointsBalance: 10,
                    status: "active",
                },
            ])
            .returning({ id: customers.id });

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest(
            `http://localhost:3000/api/customers/export?selectedIds=${first.id}`,
            {
                method: "GET",
            }
        );

        const response = await GET(request);
        const csv = await response.text();

        expect(response.status).toBe(200);
        expect(csv).toContain("Selected Customer");
        expect(csv).not.toContain("Unselected Customer");

        // Ensure request supports multiple IDs too.
        const secondRequest = new NextRequest(
            `http://localhost:3000/api/customers/export?selectedIds=${first.id}&selectedIds=${second.id}`,
            {
                method: "GET",
            }
        );

        const secondResponse = await GET(secondRequest);
        const secondCsv = await secondResponse.text();

        expect(secondResponse.status).toBe(200);
        expect(secondCsv).toContain("Selected Customer");
        expect(secondCsv).toContain("Unselected Customer");
    });
});
