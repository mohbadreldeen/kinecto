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

const createWalletPassMock = vi.fn();

vi.mock("@/lib/integrations/passkit", () => ({
    createWalletPass: (...args: unknown[]) => createWalletPassMock(...args),
}));

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

async function createTenantOwnerAndCustomer(input: {
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
        fullName: `${input.tenantName} Owner`,
        role: "owner",
        status: "active",
    });

    const [customer] = await db
        .insert(customers)
        .values({
            tenantId: tenant.id,
            name: input.customerName,
            phone: "+201099988811",
            status: "active",
        })
        .returning({ id: customers.id });

    return {
        tenantId: tenant.id,
        authUserId,
        customerId: customer.id,
    };
}

beforeEach(() => {
    mockUser = null;
    createWalletPassMock.mockReset();
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

describe("/api/wallet/create", () => {
    it("creates and persists wallet pass for customer", async () => {
        const tenant = await createTenantOwnerAndCustomer({
            tenantName: "Tenant Wallet Create",
            customerName: "Wallet Customer",
        });

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        createWalletPassMock.mockResolvedValue({
            walletPassId: "pass_123",
            downloadUrl: "https://wallet.example/pass_123.pkpass",
        });

        const request = new NextRequest(
            "http://localhost:3000/api/wallet/create",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ customerId: tenant.customerId }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.walletPassId).toBe("pass_123");

        const customer = await db.query.customers.findFirst({
            where: and(
                eq(customers.id, tenant.customerId),
                eq(customers.tenantId, tenant.tenantId)
            ),
        });
        expect(customer?.walletPassId).toBe("pass_123");
    });

    it("returns 503 when passkit is not configured", async () => {
        const tenant = await createTenantOwnerAndCustomer({
            tenantName: "Tenant Wallet Disabled",
            customerName: "Wallet Customer",
        });

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        createWalletPassMock.mockResolvedValue(null);

        const request = new NextRequest(
            "http://localhost:3000/api/wallet/create",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ customerId: tenant.customerId }),
            }
        );

        const response = await POST(request);
        expect(response.status).toBe(503);
    });
});
