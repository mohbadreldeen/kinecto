import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { customers, segments, tenants, users } from "@/lib/db/schema";

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

import { PATCH, DELETE } from "./[id]/route";
import { GET, POST } from "./route";

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
        await db.delete(segments).where(eq(segments.tenantId, tenantId));
        await db.delete(customers).where(eq(customers.tenantId, tenantId));
        await db.delete(users).where(eq(users.tenantId, tenantId));
        await db.delete(tenants).where(eq(tenants.id, tenantId));
    }

    createdTenantIds.clear();
});

describe("/api/segments", () => {
    it("creates and lists tenant segments", async () => {
        const tenant = await createTenantOwner({
            tenantName: "Tenant Segments",
        });

        await db.insert(customers).values([
            {
                tenantId: tenant.tenantId,
                name: "VIP One",
                phone: "+201055500001",
                tags: ["vip"],
                pointsBalance: 120,
                status: "active",
            },
            {
                tenantId: tenant.tenantId,
                name: "Regular One",
                phone: "+201055500002",
                tags: ["regular"],
                pointsBalance: 20,
                status: "active",
            },
        ]);

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const createRequest = new NextRequest(
            "http://localhost:3000/api/segments",
            {
                method: "POST",
                body: JSON.stringify({
                    name: "VIP customers",
                    description: "High value customers",
                    filterCriteria: {
                        tag: "vip",
                        minPoints: 100,
                        sortBy: "points",
                        sortOrder: "desc",
                    },
                }),
                headers: { "content-type": "application/json" },
            }
        );

        const createResponse = await POST(createRequest);
        const createBody = await createResponse.json();

        expect(createResponse.status).toBe(201);
        expect(createBody.data.name).toBe("VIP customers");
        expect(createBody.data.customerCount).toBe(1);

        const listResponse = await GET();
        const listBody = await listResponse.json();

        expect(listResponse.status).toBe(200);
        expect(listBody.data).toHaveLength(1);
        expect(listBody.data[0].name).toBe("VIP customers");
    });

    it("updates and deletes segment by id", async () => {
        const tenant = await createTenantOwner({
            tenantName: "Tenant Segment Mutations",
        });

        await db.insert(customers).values([
            {
                tenantId: tenant.tenantId,
                name: "Active A",
                phone: "+201066600001",
                pointsBalance: 10,
                status: "active",
            },
            {
                tenantId: tenant.tenantId,
                name: "Inactive B",
                phone: "+201066600002",
                pointsBalance: 10,
                status: "inactive",
            },
        ]);

        const [segment] = await db
            .insert(segments)
            .values({
                tenantId: tenant.tenantId,
                name: "All",
                filterCriteria: {},
                customerCount: 2,
            })
            .returning({ id: segments.id });

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const patchRequest = new NextRequest(
            `http://localhost:3000/api/segments/${segment.id}`,
            {
                method: "PATCH",
                body: JSON.stringify({
                    name: "Active only",
                    filterCriteria: {
                        status: "active",
                    },
                }),
                headers: { "content-type": "application/json" },
            }
        );

        const patchResponse = await PATCH(patchRequest, {
            params: Promise.resolve({ id: segment.id }),
        });
        const patchBody = await patchResponse.json();

        expect(patchResponse.status).toBe(200);
        expect(patchBody.data.name).toBe("Active only");
        expect(patchBody.data.customerCount).toBe(1);

        const deleteRequest = new NextRequest(
            `http://localhost:3000/api/segments/${segment.id}`,
            {
                method: "DELETE",
            }
        );

        const deleteResponse = await DELETE(deleteRequest, {
            params: Promise.resolve({ id: segment.id }),
        });

        expect(deleteResponse.status).toBe(204);

        const dbSegment = await db.query.segments.findFirst({
            where: eq(segments.id, segment.id),
        });
        expect(dbSegment).toBeUndefined();
    });
});
