import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";

function parseSelectedIds(searchParams: URLSearchParams) {
    const selectedIds = searchParams.getAll("selectedIds").flatMap((value) =>
        value
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
    );

    const uniqueIds = [...new Set(selectedIds)];
    const parsedIds = z.array(z.string().uuid()).safeParse(uniqueIds);

    if (!parsedIds.success) {
        return {
            error: NextResponse.json(
                {
                    error: "Invalid selectedIds",
                    details: parsedIds.error.flatten(),
                },
                { status: 400 }
            ),
        };
    }

    return { value: parsedIds.data };
}

export async function GET(request: NextRequest) {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    if (tenantResult.context.role !== "owner") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsedSelectedIds = parseSelectedIds(request.nextUrl.searchParams);
    if ("error" in parsedSelectedIds) {
        return parsedSelectedIds.error;
    }

    const selectedIds = parsedSelectedIds.value;
    if (selectedIds.length === 0) {
        return NextResponse.json({ data: [] });
    }

    const rows = await db
        .select({
            id: customers.id,
            name: customers.name,
            phone: customers.phone,
            pointsBalance: customers.pointsBalance,
            status: customers.status,
        })
        .from(customers)
        .where(
            and(
                eq(customers.tenantId, tenantResult.context.tenantId),
                inArray(customers.id, selectedIds)
            )
        );

    return NextResponse.json({ data: rows });
}
