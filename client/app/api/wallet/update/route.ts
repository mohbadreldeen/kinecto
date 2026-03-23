import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { updateWalletPassPoints } from "@/lib/integrations/passkit";

const updateWalletSchema = z.object({
    customerId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    if (tenantResult.context.role !== "owner") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsedBody = updateWalletSchema.safeParse(body);
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: "Invalid payload",
                details: parsedBody.error.flatten(),
            },
            { status: 400 }
        );
    }

    const customer = await db
        .select({
            id: customers.id,
            pointsBalance: customers.pointsBalance,
            walletPassId: customers.walletPassId,
        })
        .from(customers)
        .where(
            and(
                eq(customers.id, parsedBody.data.customerId),
                eq(customers.tenantId, tenantResult.context.tenantId)
            )
        )
        .limit(1)
        .then((rows) => rows[0]);

    if (!customer) {
        return NextResponse.json(
            { error: "Customer not found" },
            { status: 404 }
        );
    }

    if (!customer.walletPassId) {
        return NextResponse.json(
            { error: "Customer has no wallet pass" },
            { status: 409 }
        );
    }

    const updated = await updateWalletPassPoints({
        tenantId: tenantResult.context.tenantId,
        walletPassId: customer.walletPassId,
        pointsBalance: customer.pointsBalance,
    });

    if (!updated) {
        return NextResponse.json(
            { error: "PassKit is not configured" },
            { status: 503 }
        );
    }

    return NextResponse.json({
        data: {
            customerId: customer.id,
            walletPassId: customer.walletPassId,
            pointsBalance: customer.pointsBalance,
            updated: true,
        },
    });
}
