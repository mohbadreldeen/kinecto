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

const updateWalletPassPointsMock = vi.fn();

vi.mock("@/lib/integrations/passkit", () => ({
    updateWalletPassPoints: (...args: unknown[]) =>
        updateWalletPassPointsMock(...args),
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
    walletPassId?: string | null;
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
            name: "Wallet Update Customer",
            phone: "+201088877766",
            status: "active",
            pointsBalance: 55,
            walletPassId: input.walletPassId ?? null,
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
    updateWalletPassPointsMock.mockReset();
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

describe("/api/wallet/update", () => {
    it("pushes points update to wallet provider", async () => {
        const tenant = await createTenantOwnerAndCustomer({
            tenantName: "Tenant Wallet Update",
            walletPassId: "pass_abc",
        });

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        updateWalletPassPointsMock.mockResolvedValue({ updated: true });

        const request = new NextRequest(
            "http://localhost:3000/api/wallet/update",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ customerId: tenant.customerId }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.updated).toBe(true);
    });

    it("returns 409 when customer has no wallet pass", async () => {
        const tenant = await createTenantOwnerAndCustomer({
            tenantName: "Tenant Wallet Missing",
            walletPassId: null,
        });

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest(
            "http://localhost:3000/api/wallet/update",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ customerId: tenant.customerId }),
            }
        );

        const response = await POST(request);
        expect(response.status).toBe(409);
    });
});
