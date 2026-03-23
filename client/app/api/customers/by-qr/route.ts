import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";

const qrLookupSchema = z.object({
    qrCode: z.string().trim().min(1).max(1024),
});

function extractCustomerIdFromQr(qrCode: string): string | null {
    const directUuid = z.string().uuid().safeParse(qrCode);
    if (directUuid.success) {
        return directUuid.data;
    }

    const pathMatch = qrCode.match(
        /(?:customer|c)(?:\/[a-z-]+)?[/:]([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
    );
    if (pathMatch?.[1]) {
        return pathMatch[1];
    }

    try {
        const parsed = new URL(qrCode);
        const pathSegments = parsed.pathname.split("/").filter(Boolean);

        if (pathSegments[0] === "c" && pathSegments[1]) {
            const uuidFromDeepLink = z
                .string()
                .uuid()
                .safeParse(pathSegments[1]);
            if (uuidFromDeepLink.success) {
                return uuidFromDeepLink.data;
            }
        }

        const customerSegmentIndex = pathSegments.findIndex(
            (segment) => segment.toLowerCase() === "customer"
        );
        if (
            customerSegmentIndex >= 0 &&
            pathSegments[customerSegmentIndex + 1]
        ) {
            const uuidFromCustomerPath = z
                .string()
                .uuid()
                .safeParse(pathSegments[customerSegmentIndex + 1]);
            if (uuidFromCustomerPath.success) {
                return uuidFromCustomerPath.data;
            }
        }

        const fromQuery =
            parsed.searchParams.get("customerId") ??
            parsed.searchParams.get("id");

        const uuid = z.string().uuid().safeParse(fromQuery);
        if (uuid.success) {
            return uuid.data;
        }
    } catch {
        // Ignore parse errors; QR value may not be a URL.
    }

    return null;
}

export async function POST(request: NextRequest) {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    const body = await request.json().catch(() => null);
    const parsedBody = qrLookupSchema.safeParse(body);

    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: "Invalid request body",
                details: parsedBody.error.flatten(),
            },
            { status: 400 }
        );
    }

    const qrCode = parsedBody.data.qrCode.trim();
    const extractedCustomerId = extractCustomerIdFromQr(qrCode);

    const customer = extractedCustomerId
        ? await db.query.customers.findFirst({
              where: and(
                  eq(customers.tenantId, tenantResult.context.tenantId),
                  eq(customers.id, extractedCustomerId)
              ),
          })
        : await db.query.customers.findFirst({
              where: and(
                  eq(customers.tenantId, tenantResult.context.tenantId),
                  eq(customers.qrCodeUrl, qrCode)
              ),
          });

    if (!customer) {
        return NextResponse.json(
            { error: "Customer not found for this QR code" },
            { status: 404 }
        );
    }

    return NextResponse.json({
        data: {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
            qrCodeUrl: customer.qrCodeUrl,
        },
    });
}
