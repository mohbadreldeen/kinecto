import { and, desc, eq, gte, inArray, lt, lte, ne, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import { customers, transactions, users } from "@/lib/db/schema";

const updateCustomerSchema = z
    .object({
        name: z.string().trim().min(1).max(120).optional(),
        phone: z.string().trim().min(6).max(30).optional(),
        email: z.email().nullable().optional(),
        tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
        notes: z.string().trim().max(1000).nullable().optional(),
        status: z.enum(["active", "inactive"]).optional(),
        unsubscribed: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, {
        message: "At least one field must be provided",
    });

const idParamSchema = z.object({
    id: z.string().uuid(),
});

const transactionQuerySchema = z
    .object({
        txPageSize: z.coerce.number().int().min(1).max(50).default(10),
        txFrom: z.coerce.date().optional(),
        txTo: z.coerce.date().optional(),
        txCursorCreatedAt: z.coerce.date().optional(),
        txCursorId: z.string().uuid().optional(),
    })
    .refine(
        (value) => !value.txFrom || !value.txTo || value.txFrom <= value.txTo,
        { message: "txFrom must be before or equal to txTo", path: ["txFrom"] }
    )
    .refine(
        (value) =>
            (value.txCursorCreatedAt && value.txCursorId) ||
            (!value.txCursorCreatedAt && !value.txCursorId),
        {
            message:
                "txCursorCreatedAt and txCursorId must be provided together",
            path: ["txCursorCreatedAt"],
        }
    );

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const tenantResult = await requireTenantContext();
    if ("response" in tenantResult) {
        return tenantResult.response;
    }

    const params = await context.params;
    const parsedParams = idParamSchema.safeParse(params);
    if (!parsedParams.success) {
        return NextResponse.json(
            {
                error: "Invalid customer id",
                details: parsedParams.error.flatten(),
            },
            { status: 400 }
        );
    }

    const parsedQuery = transactionQuerySchema.safeParse({
        txPageSize: request.nextUrl.searchParams.get("txPageSize") ?? undefined,
        txFrom: request.nextUrl.searchParams.get("txFrom") ?? undefined,
        txTo: request.nextUrl.searchParams.get("txTo") ?? undefined,
        txCursorCreatedAt:
            request.nextUrl.searchParams.get("txCursorCreatedAt") ?? undefined,
        txCursorId: request.nextUrl.searchParams.get("txCursorId") ?? undefined,
    });

    if (!parsedQuery.success) {
        return NextResponse.json(
            {
                error: "Invalid query params",
                details: parsedQuery.error.flatten(),
            },
            { status: 400 }
        );
    }

    const { txPageSize, txFrom, txTo, txCursorCreatedAt, txCursorId } =
        parsedQuery.data;

    const transactionWhere = and(
        eq(transactions.customerId, parsedParams.data.id),
        eq(transactions.tenantId, tenantResult.context.tenantId),
        txFrom ? gte(transactions.createdAt, txFrom) : undefined,
        txTo ? lte(transactions.createdAt, txTo) : undefined,
        txCursorCreatedAt && txCursorId
            ? or(
                  lt(transactions.createdAt, txCursorCreatedAt),
                  and(
                      eq(transactions.createdAt, txCursorCreatedAt),
                      lt(transactions.id, txCursorId)
                  )
              )
            : undefined
    );

    const [customer, recentTransactions] = await Promise.all([
        db
            .select({
                id: customers.id,
                name: customers.name,
                phone: customers.phone,
                email: customers.email,
                pointsBalance: customers.pointsBalance,
                tags: customers.tags,
                notes: customers.notes,
                qrCodeUrl: customers.qrCodeUrl,
                status: customers.status,
                lastVisitAt: customers.lastVisitAt,
                createdAt: customers.createdAt,
                updatedAt: customers.updatedAt,
            })
            .from(customers)
            .where(
                and(
                    eq(customers.id, parsedParams.data.id),
                    eq(customers.tenantId, tenantResult.context.tenantId)
                )
            )
            .limit(1)
            .then((rows) => rows[0]),
        db
            .select({
                id: transactions.id,
                type: transactions.type,
                amount: transactions.amount,
                balanceAfter: transactions.balanceAfter,
                note: transactions.note,
                performedBy: transactions.performedBy,
                createdAt: transactions.createdAt,
            })
            .from(transactions)
            .where(transactionWhere)
            .orderBy(desc(transactions.createdAt), desc(transactions.id))
            .limit(txPageSize + 1),
    ]);

    const performerIds = [
        ...new Set(
            recentTransactions
                .map((transaction) => transaction.performedBy)
                .filter((value): value is string => Boolean(value))
        ),
    ];

    const performers =
        performerIds.length > 0
            ? await db
                  .select({
                      id: users.id,
                      fullName: users.fullName,
                      email: users.email,
                  })
                  .from(users)
                  .where(
                      and(
                          eq(users.tenantId, tenantResult.context.tenantId),
                          inArray(users.id, performerIds)
                      )
                  )
            : [];

    const performerMap = new Map(
        performers.map((performer) => [performer.id, performer])
    );

    if (!customer) {
        return NextResponse.json(
            { error: "Customer not found" },
            { status: 404 }
        );
    }

    const hasMore = recentTransactions.length > txPageSize;
    const visibleTransactions = recentTransactions.slice(0, txPageSize);
    const lastVisibleTransaction =
        visibleTransactions[visibleTransactions.length - 1];

    return NextResponse.json({
        data: {
            ...customer,
            recentTransactions: visibleTransactions.map((transaction) => {
                const performer = transaction.performedBy
                    ? performerMap.get(transaction.performedBy)
                    : null;

                return {
                    ...transaction,
                    performedByUserId: transaction.performedBy,
                    performedByName:
                        performer?.fullName ?? performer?.email ?? null,
                };
            }),
            transactionPagination: {
                pageSize: txPageSize,
                returned: visibleTransactions.length,
                hasMore,
                nextCursor:
                    hasMore && lastVisibleTransaction
                        ? {
                              createdAt:
                                  lastVisibleTransaction.createdAt.toISOString(),
                              id: lastVisibleTransaction.id,
                          }
                        : null,
                appliedFilters: {
                    txFrom: txFrom?.toISOString() ?? null,
                    txTo: txTo?.toISOString() ?? null,
                },
            },
        },
    });
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const tenantResult = await requireTenantContext();
    if ("response" in tenantResult) {
        return tenantResult.response;
    }

    const params = await context.params;
    const parsedParams = idParamSchema.safeParse(params);
    if (!parsedParams.success) {
        return NextResponse.json(
            {
                error: "Invalid customer id",
                details: parsedParams.error.flatten(),
            },
            { status: 400 }
        );
    }

    const json = await request.json().catch(() => null);
    const parsedBody = updateCustomerSchema.safeParse(json);

    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: "Invalid request body",
                details: parsedBody.error.flatten(),
            },
            { status: 400 }
        );
    }

    if (parsedBody.data.phone) {
        const duplicatePhoneCustomer = await db.query.customers.findFirst({
            where: and(
                eq(customers.tenantId, tenantResult.context.tenantId),
                eq(customers.phone, parsedBody.data.phone.trim()),
                ne(customers.id, parsedParams.data.id)
            ),
            columns: { id: true },
        });

        if (duplicatePhoneCustomer) {
            return NextResponse.json(
                {
                    error: "A customer with this phone number already exists",
                },
                { status: 409 }
            );
        }
    }

    const [updated] = await db
        .update(customers)
        .set({
            name: parsedBody.data.name,
            phone: parsedBody.data.phone?.trim(),
            email: parsedBody.data.email ?? undefined,
            tags: parsedBody.data.tags,
            notes: parsedBody.data.notes ?? undefined,
            status: parsedBody.data.status,
            unsubscribed: parsedBody.data.unsubscribed,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(customers.id, parsedParams.data.id),
                eq(customers.tenantId, tenantResult.context.tenantId)
            )
        )
        .returning({
            id: customers.id,
            name: customers.name,
            phone: customers.phone,
            email: customers.email,
            pointsBalance: customers.pointsBalance,
            status: customers.status,
            updatedAt: customers.updatedAt,
        });

    if (!updated) {
        return NextResponse.json(
            { error: "Customer not found" },
            { status: 404 }
        );
    }

    return NextResponse.json({ data: updated });
}

export async function DELETE(
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const tenantResult = await requireTenantContext();
    if ("response" in tenantResult) {
        return tenantResult.response;
    }

    const params = await context.params;
    const parsedParams = idParamSchema.safeParse(params);
    if (!parsedParams.success) {
        return NextResponse.json(
            {
                error: "Invalid customer id",
                details: parsedParams.error.flatten(),
            },
            { status: 400 }
        );
    }

    const [deleted] = await db
        .update(customers)
        .set({
            status: "inactive",
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(customers.id, parsedParams.data.id),
                eq(customers.tenantId, tenantResult.context.tenantId)
            )
        )
        .returning({ id: customers.id });

    if (!deleted) {
        return NextResponse.json(
            { error: "Customer not found" },
            { status: 404 }
        );
    }

    return new NextResponse(null, { status: 204 });
}
