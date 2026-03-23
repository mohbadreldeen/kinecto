import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import { customers, transactions } from "@/lib/db/schema";
import { updateWalletPassPoints } from "@/lib/integrations/passkit";

const idParamSchema = z.object({
    id: z.string().uuid(),
});

const adjustPointsSchema = z.object({
    type: z.enum(["credit", "debit"]),
    amount: z.coerce.number().int().min(1).max(100_000),
    note: z.string().trim().max(500).optional(),
});

export async function POST(
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
    const parsedBody = adjustPointsSchema.safeParse(json);
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: "Invalid request body",
                details: parsedBody.error.flatten(),
            },
            { status: 400 }
        );
    }

    const payload = parsedBody.data;

    const result = await db.transaction(async (tx) => {
        const [customer] = await tx
            .select({
                id: customers.id,
                pointsBalance: customers.pointsBalance,
                walletPassId: customers.walletPassId,
            })
            .from(customers)
            .where(
                and(
                    eq(customers.id, parsedParams.data.id),
                    eq(customers.tenantId, tenantResult.context.tenantId)
                )
            )
            .limit(1);

        if (!customer) {
            return { status: 404 as const, error: "Customer not found" };
        }

        const delta =
            payload.type === "credit" ? payload.amount : -payload.amount;
        const nextBalance = customer.pointsBalance + delta;

        if (nextBalance < 0) {
            return {
                status: 400 as const,
                error: "Insufficient points balance for deduction",
            };
        }

        await tx
            .update(customers)
            .set({
                pointsBalance: nextBalance,
                lastVisitAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(customers.id, customer.id));

        const [transaction] = await tx
            .insert(transactions)
            .values({
                tenantId: tenantResult.context.tenantId,
                customerId: customer.id,
                performedBy: tenantResult.context.userId,
                type: payload.type,
                amount: payload.amount,
                balanceAfter: nextBalance,
                note: payload.note,
            })
            .returning({ id: transactions.id });

        return {
            status: 200 as const,
            data: {
                customerId: customer.id,
                type: payload.type,
                amount: payload.amount,
                balanceAfter: nextBalance,
                transactionId: transaction.id,
                walletPassId: customer.walletPassId,
            },
        };
    });

    if (result.status !== 200) {
        return NextResponse.json(
            { error: result.error },
            { status: result.status }
        );
    }

    if (result.data.walletPassId) {
        try {
            await updateWalletPassPoints({
                tenantId: tenantResult.context.tenantId,
                walletPassId: result.data.walletPassId,
                pointsBalance: result.data.balanceAfter,
            });
        } catch {
            // Keep points flow successful even if wallet provider is unavailable.
        }
    }

    return NextResponse.json({
        data: {
            customerId: result.data.customerId,
            type: result.data.type,
            amount: result.data.amount,
            balanceAfter: result.data.balanceAfter,
            transactionId: result.data.transactionId,
        },
    });
}
