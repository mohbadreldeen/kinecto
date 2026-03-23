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

import { POST } from "./route";

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
        role: "employee",
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
            qrCodeUrl: `kinecto://customer/${randomUUID()}`,
            status: "active",
        })
        .returning({
            id: customers.id,
            tenantId: customers.tenantId,
            name: customers.name,
            qrCodeUrl: customers.qrCodeUrl,
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

describe("/api/customers/by-qr", () => {
    it("returns 401 when auth user is missing", async () => {
        const request = new NextRequest(
            "http://localhost:3000/api/customers/by-qr",
            {
                method: "POST",
                body: JSON.stringify({ qrCode: "abc" }),
                headers: { "content-type": "application/json" },
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe("Unauthorized");
    });

    it("finds customer by direct customer UUID in qr payload", async () => {
        const tenant = await createTenantUserAndCustomer({
            tenantName: "Tenant QR UUID",
            customerName: "QR UUID Customer",
        });

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest(
            "http://localhost:3000/api/customers/by-qr",
            {
                method: "POST",
                body: JSON.stringify({ qrCode: tenant.customer.id }),
                headers: { "content-type": "application/json" },
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.id).toBe(tenant.customer.id);
        expect(body.data.name).toBe("QR UUID Customer");
    });

    it("finds customer by kinecto://customer/<id> format", async () => {
        const tenant = await createTenantUserAndCustomer({
            tenantName: "Tenant QR URI",
            customerName: "QR URI Customer",
        });

        await db
            .update(customers)
            .set({ qrCodeUrl: `kinecto://customer/${tenant.customer.id}` })
            .where(
                and(
                    eq(customers.id, tenant.customer.id),
                    eq(customers.tenantId, tenant.tenantId)
                )
            );

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest(
            "http://localhost:3000/api/customers/by-qr",
            {
                method: "POST",
                body: JSON.stringify({
                    qrCode: `kinecto://customer/${tenant.customer.id}`,
                }),
                headers: { "content-type": "application/json" },
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.id).toBe(tenant.customer.id);
    });

    it("finds customer by https://domain/c/<id> deep link format", async () => {
        const tenant = await createTenantUserAndCustomer({
            tenantName: "Tenant QR Deep Link",
            customerName: "QR Deep Link Customer",
        });

        await db
            .update(customers)
            .set({
                qrCodeUrl: `https://app.kinecto.com/c/${tenant.customer.id}`,
            })
            .where(
                and(
                    eq(customers.id, tenant.customer.id),
                    eq(customers.tenantId, tenant.tenantId)
                )
            );

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest(
            "http://localhost:3000/api/customers/by-qr",
            {
                method: "POST",
                body: JSON.stringify({
                    qrCode: `https://app.kinecto.com/c/${tenant.customer.id}`,
                }),
                headers: { "content-type": "application/json" },
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.id).toBe(tenant.customer.id);
    });

    it("returns 404 when qr points to another tenant customer", async () => {
        const tenantA = await createTenantUserAndCustomer({
            tenantName: "Tenant A",
            customerName: "Alice",
        });
        const tenantB = await createTenantUserAndCustomer({
            tenantName: "Tenant B",
            customerName: "Bob",
        });

        mockUser = {
            id: tenantA.authUserId,
            app_metadata: { tenantId: tenantA.tenantId },
        };

        const request = new NextRequest(
            "http://localhost:3000/api/customers/by-qr",
            {
                method: "POST",
                body: JSON.stringify({
                    qrCode: `kinecto://customer/${tenantB.customer.id}`,
                }),
                headers: { "content-type": "application/json" },
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body.error).toBe("Customer not found for this QR code");
    });
});
