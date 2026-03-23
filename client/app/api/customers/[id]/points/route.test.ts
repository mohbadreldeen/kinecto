import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { customers, tenants, transactions, users } from "@/lib/db/schema";

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
    pointsBalance?: number;
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

    const [membership] = await db
        .insert(users)
        .values({
            tenantId: tenant.id,
            authUserId,
            email: `${slug}@example.test`,
            fullName: `${input.tenantName} User`,
            role: "employee",
            status: "active",
        })
        .returning({ id: users.id });

    const [customer] = await db
        .insert(customers)
        .values({
            tenantId: tenant.id,
            name: input.customerName,
            phone: `+2010${Math.floor(Math.random() * 1000000)
                .toString()
                .padStart(6, "0")}`,
            pointsBalance: input.pointsBalance ?? 0,
            status: "active",
        })
        .returning({
            id: customers.id,
            tenantId: customers.tenantId,
            pointsBalance: customers.pointsBalance,
        });

    return {
        tenantId: tenant.id,
        authUserId,
        userId: membership.id,
        customer,
    };
}

beforeEach(() => {
    mockUser = null;
});

afterEach(async () => {
    if (createdTenantIds.size === 0) return;

    for (const tenantId of createdTenantIds) {
        await db
            .delete(transactions)
            .where(eq(transactions.tenantId, tenantId));
        await db.delete(customers).where(eq(customers.tenantId, tenantId));
        await db.delete(users).where(eq(users.tenantId, tenantId));
        await db.delete(tenants).where(eq(tenants.id, tenantId));
    }

    createdTenantIds.clear();
});

describe("/api/customers/[id]/points POST", () => {
    it("credits points and writes transaction", async () => {
        const tenant = await createTenantUserAndCustomer({
            tenantName: "Tenant Credit",
            customerName: "Credit Customer",
            pointsBalance: 10,
        });

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest(
            `http://localhost:3000/api/customers/${tenant.customer.id}/points`,
            {
                method: "POST",
                body: JSON.stringify({
                    type: "credit",
                    amount: 15,
                    note: "Manual adjustment",
                }),
                headers: { "content-type": "application/json" },
            }
        );

        const response = await POST(request, {
            params: Promise.resolve({ id: tenant.customer.id }),
        });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.balanceAfter).toBe(25);
        expect(body.data.amount).toBe(15);

        const dbCustomer = await db.query.customers.findFirst({
            where: and(
                eq(customers.id, tenant.customer.id),
                eq(customers.tenantId, tenant.tenantId)
            ),
        });
        expect(dbCustomer?.pointsBalance).toBe(25);

        const dbTransaction = await db.query.transactions.findFirst({
            where: eq(transactions.id, body.data.transactionId),
        });
        expect(dbTransaction?.type).toBe("credit");
        expect(dbTransaction?.balanceAfter).toBe(25);
        expect(dbTransaction?.performedBy).toBe(tenant.userId);
    });

    it("rejects debit when amount exceeds current balance", async () => {
        const tenant = await createTenantUserAndCustomer({
            tenantName: "Tenant Debit",
            customerName: "Debit Customer",
            pointsBalance: 5,
        });

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest(
            `http://localhost:3000/api/customers/${tenant.customer.id}/points`,
            {
                method: "POST",
                body: JSON.stringify({
                    type: "debit",
                    amount: 10,
                }),
                headers: { "content-type": "application/json" },
            }
        );

        const response = await POST(request, {
            params: Promise.resolve({ id: tenant.customer.id }),
        });
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe("Insufficient points balance for deduction");

        const dbCustomer = await db.query.customers.findFirst({
            where: eq(customers.id, tenant.customer.id),
        });
        expect(dbCustomer?.pointsBalance).toBe(5);

        const dbTransactions = await db
            .select({ id: transactions.id })
            .from(transactions)
            .where(eq(transactions.customerId, tenant.customer.id));
        expect(dbTransactions).toHaveLength(0);
    });
});
