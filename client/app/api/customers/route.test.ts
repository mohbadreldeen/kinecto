import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
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

import { GET, POST } from "./route";

const createdTenantIds = new Set<string>();

async function createTenantUserAndCustomer(input: {
    tenantName: string;
    customerName: string;
}) {
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
        fullName: `${input.tenantName} User`,
        role: "owner",
        status: "active",
    });

    const [customer] = await db
        .insert(customers)
        .values({
            tenantId: tenant.id,
            name: input.customerName,
            phone: `+2010${Math.floor(Math.random() * 1000000)
                .toString()
                .padStart(6, "0")}`,
            status: "active",
        })
        .returning({
            id: customers.id,
            tenantId: customers.tenantId,
            name: customers.name,
        });

    return { tenantId: tenant.id, authUserId, customer };
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

describe("/api/customers", () => {
    it("returns 401 when auth user is missing", async () => {
        const request = new NextRequest("http://localhost:3000/api/customers", {
            method: "GET",
        });

        const response = await GET(request);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe("Unauthorized");
    });

    it("returns only current tenant customers", async () => {
        const tenantA = await createTenantUserAndCustomer({
            tenantName: "Tenant A",
            customerName: "Alice",
        });
        await createTenantUserAndCustomer({
            tenantName: "Tenant B",
            customerName: "Bob",
        });

        mockUser = {
            id: tenantA.authUserId,
            app_metadata: { tenantId: tenantA.tenantId },
        };

        const request = new NextRequest("http://localhost:3000/api/customers", {
            method: "GET",
        });

        const response = await GET(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].name).toBe("Alice");
    });

    it("filters by search term for current tenant", async () => {
        const tenant = await createTenantUserAndCustomer({
            tenantName: "Tenant Search",
            customerName: "Alice Search",
        });

        await db.insert(customers).values({
            tenantId: tenant.tenantId,
            name: "Bob Search",
            phone: "+201022222222",
            status: "active",
        });

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest(
            "http://localhost:3000/api/customers?search=Alice",
            {
                method: "GET",
            }
        );

        const response = await GET(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].name).toBe("Alice Search");
    });

    it("returns 400 for invalid create payload", async () => {
        const tenant = await createTenantUserAndCustomer({
            tenantName: "Tenant Invalid",
            customerName: "Seed",
        });

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest("http://localhost:3000/api/customers", {
            method: "POST",
            body: JSON.stringify({ phone: "+2010000000" }),
            headers: {
                "content-type": "application/json",
            },
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe("Invalid request body");
    });

    it("creates a customer for the authenticated tenant", async () => {
        const tenant = await createTenantUserAndCustomer({
            tenantName: "Tenant Create",
            customerName: "Seed",
        });

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest("http://localhost:3000/api/customers", {
            method: "POST",
            body: JSON.stringify({
                name: "New Customer",
                phone: "+201011111111",
                tags: ["vip"],
            }),
            headers: {
                "content-type": "application/json",
            },
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(body.data.name).toBe("New Customer");
        expect(body.data.qrCodeUrl).toBe(
            `http://localhost:3000/c/${body.data.id}`
        );

        const dbRow = await db.query.customers.findFirst({
            where: and(
                eq(customers.tenantId, tenant.tenantId),
                eq(customers.name, "New Customer")
            ),
        });

        expect(dbRow).toBeTruthy();
        expect(dbRow?.qrCodeUrl).toBe(
            `http://localhost:3000/c/${body.data.id}`
        );
    });

    it("returns 409 when creating duplicate phone in the same tenant", async () => {
        const tenant = await createTenantUserAndCustomer({
            tenantName: "Tenant Duplicate",
            customerName: "Seed",
        });

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        await db.insert(customers).values({
            tenantId: tenant.tenantId,
            name: "Existing",
            phone: "+201099988877",
            status: "active",
        });

        const request = new NextRequest("http://localhost:3000/api/customers", {
            method: "POST",
            body: JSON.stringify({
                name: "Duplicate",
                phone: "+201099988877",
            }),
            headers: {
                "content-type": "application/json",
            },
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body.error).toBe(
            "A customer with this phone number already exists"
        );
    });

    it("supports CRM filters and sorting", async () => {
        const tenant = await createTenantUserAndCustomer({
            tenantName: "Tenant CRM Filters",
            customerName: "Seed",
        });

        await db.insert(customers).values([
            {
                tenantId: tenant.tenantId,
                name: "Alpha",
                phone: "+201011100001",
                pointsBalance: 100,
                status: "active",
                tags: ["vip"],
                createdAt: new Date("2026-03-01T00:00:00.000Z"),
            },
            {
                tenantId: tenant.tenantId,
                name: "Beta",
                phone: "+201011100002",
                pointsBalance: 10,
                status: "inactive",
                tags: ["regular"],
                createdAt: new Date("2026-03-02T00:00:00.000Z"),
            },
        ]);

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest(
            "http://localhost:3000/api/customers?status=active&tag=vip&minPoints=50&sortBy=name&sortOrder=asc",
            {
                method: "GET",
            }
        );

        const response = await GET(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.length).toBeGreaterThanOrEqual(1);
        expect(body.data[0].status).toBe("active");
    });
});
