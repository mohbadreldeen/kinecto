import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
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

import { DELETE, GET } from "./route";

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

    const [user] = await db
        .insert(users)
        .values({
            tenantId: tenant.id,
            authUserId,
            email: `${slug}@example.test`,
            fullName: `${input.tenantName} User`,
            role: "owner",
            status: "active",
        })
        .returning({ id: users.id, fullName: users.fullName });

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

    return { tenantId: tenant.id, authUserId, customer, user };
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

describe("/api/customers/[id] GET", () => {
    it("returns 401 when auth user is missing", async () => {
        const request = new NextRequest(
            "http://localhost:3000/api/customers/00000000-0000-0000-0000-000000000000",
            {
                method: "GET",
            }
        );

        const response = await GET(request, {
            params: Promise.resolve({
                id: "00000000-0000-0000-0000-000000000000",
            }),
        });

        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe("Unauthorized");
    });

    it("returns customer profile for same tenant", async () => {
        const tenant = await createTenantUserAndCustomer({
            tenantName: "Tenant Profile",
            customerName: "Profile Customer",
        });

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest(
            `http://localhost:3000/api/customers/${tenant.customer.id}`,
            {
                method: "GET",
            }
        );

        const response = await GET(request, {
            params: Promise.resolve({ id: tenant.customer.id }),
        });

        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.id).toBe(tenant.customer.id);
        expect(body.data.name).toBe("Profile Customer");
        expect(body.data.recentTransactions).toEqual([]);
    });

    it("returns recent transactions for customer in descending order", async () => {
        const tenant = await createTenantUserAndCustomer({
            tenantName: "Tenant History",
            customerName: "History Customer",
        });

        await db.insert(transactions).values([
            {
                tenantId: tenant.tenantId,
                customerId: tenant.customer.id,
                type: "credit",
                amount: 20,
                balanceAfter: 20,
                note: "Welcome bonus",
                createdAt: new Date("2026-03-20T10:00:00.000Z"),
            },
            {
                tenantId: tenant.tenantId,
                customerId: tenant.customer.id,
                performedBy: tenant.user.id,
                type: "debit",
                amount: 5,
                balanceAfter: 15,
                note: "Redeem",
                createdAt: new Date("2026-03-20T10:05:00.000Z"),
            },
        ]);

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest(
            `http://localhost:3000/api/customers/${tenant.customer.id}`,
            {
                method: "GET",
            }
        );

        const response = await GET(request, {
            params: Promise.resolve({ id: tenant.customer.id }),
        });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.recentTransactions).toHaveLength(2);
        expect(body.data.recentTransactions[0].type).toBe("debit");
        expect(body.data.recentTransactions[0].amount).toBe(5);
        expect(body.data.recentTransactions[0].performedByName).toBe(
            tenant.user.fullName
        );
        expect(body.data.recentTransactions[1].type).toBe("credit");
        expect(body.data.recentTransactions[1].amount).toBe(20);
        expect(body.data.transactionPagination.hasMore).toBe(false);
    });

    it("supports cursor pagination metadata", async () => {
        const tenant = await createTenantUserAndCustomer({
            tenantName: "Tenant Pagination",
            customerName: "Pagination Customer",
        });

        await db.insert(transactions).values([
            {
                tenantId: tenant.tenantId,
                customerId: tenant.customer.id,
                type: "credit",
                amount: 10,
                balanceAfter: 10,
                createdAt: new Date("2026-03-20T10:00:00.000Z"),
            },
            {
                tenantId: tenant.tenantId,
                customerId: tenant.customer.id,
                type: "credit",
                amount: 10,
                balanceAfter: 20,
                createdAt: new Date("2026-03-20T10:05:00.000Z"),
            },
            {
                tenantId: tenant.tenantId,
                customerId: tenant.customer.id,
                type: "debit",
                amount: 5,
                balanceAfter: 15,
                createdAt: new Date("2026-03-20T10:10:00.000Z"),
            },
        ]);

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest(
            `http://localhost:3000/api/customers/${tenant.customer.id}?txPageSize=2`,
            {
                method: "GET",
            }
        );

        const response = await GET(request, {
            params: Promise.resolve({ id: tenant.customer.id }),
        });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.recentTransactions).toHaveLength(2);
        expect(body.data.transactionPagination.pageSize).toBe(2);
        expect(body.data.transactionPagination.returned).toBe(2);
        expect(body.data.transactionPagination.hasMore).toBe(true);
        expect(body.data.transactionPagination.nextCursor).toMatchObject({
            id: expect.any(String),
            createdAt: expect.any(String),
        });

        const nextCursor = body.data.transactionPagination.nextCursor as {
            id: string;
            createdAt: string;
        };

        const secondRequest = new NextRequest(
            `http://localhost:3000/api/customers/${tenant.customer.id}?txPageSize=2&txCursorCreatedAt=${encodeURIComponent(nextCursor.createdAt)}&txCursorId=${nextCursor.id}`,
            {
                method: "GET",
            }
        );

        const secondResponse = await GET(secondRequest, {
            params: Promise.resolve({ id: tenant.customer.id }),
        });
        const secondBody = await secondResponse.json();

        expect(secondResponse.status).toBe(200);
        expect(secondBody.data.recentTransactions).toHaveLength(1);
        expect(secondBody.data.transactionPagination.hasMore).toBe(false);
        expect(secondBody.data.transactionPagination.nextCursor).toBeNull();
    });

    it("filters transactions by date range", async () => {
        const tenant = await createTenantUserAndCustomer({
            tenantName: "Tenant Date Filter",
            customerName: "Date Filter Customer",
        });

        await db.insert(transactions).values([
            {
                tenantId: tenant.tenantId,
                customerId: tenant.customer.id,
                type: "credit",
                amount: 10,
                balanceAfter: 10,
                createdAt: new Date("2026-03-18T09:00:00.000Z"),
            },
            {
                tenantId: tenant.tenantId,
                customerId: tenant.customer.id,
                type: "debit",
                amount: 3,
                balanceAfter: 7,
                createdAt: new Date("2026-03-20T09:00:00.000Z"),
            },
            {
                tenantId: tenant.tenantId,
                customerId: tenant.customer.id,
                type: "credit",
                amount: 4,
                balanceAfter: 11,
                createdAt: new Date("2026-03-22T09:00:00.000Z"),
            },
        ]);

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest(
            `http://localhost:3000/api/customers/${tenant.customer.id}?txFrom=2026-03-19T00:00:00.000Z&txTo=2026-03-21T23:59:59.999Z`,
            {
                method: "GET",
            }
        );

        const response = await GET(request, {
            params: Promise.resolve({ id: tenant.customer.id }),
        });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.recentTransactions).toHaveLength(1);
        expect(body.data.recentTransactions[0].type).toBe("debit");
        expect(body.data.transactionPagination.appliedFilters.txFrom).toBe(
            "2026-03-19T00:00:00.000Z"
        );
        expect(body.data.transactionPagination.appliedFilters.txTo).toBe(
            "2026-03-21T23:59:59.999Z"
        );
    });

    it("returns 404 when customer belongs to another tenant", async () => {
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
            `http://localhost:3000/api/customers/${tenantB.customer.id}`,
            {
                method: "GET",
            }
        );

        const response = await GET(request, {
            params: Promise.resolve({ id: tenantB.customer.id }),
        });
        const body = await response.json();

        expect(response.status).toBe(404);
        expect(body.error).toBe("Customer not found");
    });

    it("soft deletes customer by setting status inactive", async () => {
        const tenant = await createTenantUserAndCustomer({
            tenantName: "Tenant Soft Delete",
            customerName: "Delete Me",
        });

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest(
            `http://localhost:3000/api/customers/${tenant.customer.id}`,
            {
                method: "DELETE",
            }
        );

        const response = await DELETE(request, {
            params: Promise.resolve({ id: tenant.customer.id }),
        });

        expect(response.status).toBe(204);

        const dbCustomer = await db.query.customers.findFirst({
            where: eq(customers.id, tenant.customer.id),
        });

        expect(dbCustomer).toBeTruthy();
        expect(dbCustomer?.status).toBe("inactive");
    });
});
