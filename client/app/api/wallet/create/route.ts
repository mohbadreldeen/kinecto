import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { createWalletPass } from "@/lib/integrations/passkit";

const createWalletSchema = z.object({
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
    const parsedBody = createWalletSchema.safeParse(body);
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
            name: customers.name,
            phone: customers.phone,
            pointsBalance: customers.pointsBalance,
            qrCodeUrl: customers.qrCodeUrl,
            createdAt: customers.createdAt,
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

    const pass = await createWalletPass({
        tenantId: tenantResult.context.tenantId,
        customerId: customer.id,
        customerName: customer.name,
        phone: customer.phone,
        pointsBalance: customer.pointsBalance,
        qrCodeUrl: customer.qrCodeUrl,
        memberSinceIso: customer.createdAt.toISOString(),
        tenantName: tenantResult.context.tenantId,
    });

    if (!pass) {
        return NextResponse.json(
            { error: "PassKit is not configured" },
            { status: 503 }
        );
    }

    await db
        .update(customers)
        .set({
            walletPassId: pass.walletPassId,
            updatedAt: new Date(),
        })
        .where(eq(customers.id, customer.id));

    return NextResponse.json({
        data: {
            customerId: customer.id,
            walletPassId: pass.walletPassId,
            walletPassUrl: pass.downloadUrl,
        },
    });
}
