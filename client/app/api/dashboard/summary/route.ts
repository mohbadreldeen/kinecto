import { and, count, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import { customers, transactions, users } from "@/lib/db/schema";

export async function GET() {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    const tenantId = tenantResult.context.tenantId;

    const [
        totalCustomers,
        activeCustomers,
        activeEmployees,
        recentCustomers,
        recentTransactions,
    ] = await Promise.all([
        db
            .select({ value: count() })
            .from(customers)
            .where(eq(customers.tenantId, tenantId)),
        db
            .select({ value: count() })
            .from(customers)
            .where(
                and(
                    eq(customers.tenantId, tenantId),
                    eq(customers.status, "active")
                )
            ),
        db
            .select({ value: count() })
            .from(users)
            .where(
                and(
                    eq(users.tenantId, tenantId),
                    eq(users.role, "employee"),
                    eq(users.status, "active")
                )
            ),
        db
            .select({
                id: customers.id,
                name: customers.name,
                phone: customers.phone,
                pointsBalance: customers.pointsBalance,
                createdAt: customers.createdAt,
            })
            .from(customers)
            .where(eq(customers.tenantId, tenantId))
            .orderBy(desc(customers.createdAt))
            .limit(5),
        db
            .select({
                id: transactions.id,
                customerId: transactions.customerId,
                type: transactions.type,
                amount: transactions.amount,
                balanceAfter: transactions.balanceAfter,
                note: transactions.note,
                createdAt: transactions.createdAt,
            })
            .from(transactions)
            .where(eq(transactions.tenantId, tenantId))
            .orderBy(desc(transactions.createdAt), desc(transactions.id))
            .limit(10),
    ]);

    const customerIds = [
        ...new Set(recentTransactions.map((tx) => tx.customerId)),
    ];
    const transactionCustomers =
        customerIds.length > 0
            ? await db
                  .select({
                      id: customers.id,
                      name: customers.name,
                  })
                  .from(customers)
                  .where(
                      and(
                          eq(customers.tenantId, tenantId),
                          inArray(customers.id, customerIds)
                      )
                  )
            : [];

    const customerNameMap = new Map(
        transactionCustomers.map((customer) => [customer.id, customer.name])
    );

    return NextResponse.json({
        data: {
            tenant: {
                id: tenantId,
                role: tenantResult.context.role,
                email: tenantResult.context.email,
            },
            metrics: {
                totalCustomers: Number(totalCustomers[0]?.value ?? 0),
                activeCustomers: Number(activeCustomers[0]?.value ?? 0),
                activeEmployees: Number(activeEmployees[0]?.value ?? 0),
            },
            recentCustomers,
            recentTransactions: recentTransactions.map((transaction) => ({
                ...transaction,
                customerName:
                    customerNameMap.get(transaction.customerId) ?? "Unknown",
            })),
        },
    });
}
