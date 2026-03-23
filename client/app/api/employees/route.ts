import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function GET() {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    if (tenantResult.context.role !== "owner") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await db
        .select({
            id: users.id,
            email: users.email,
            fullName: users.fullName,
            status: users.status,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
        })
        .from(users)
        .where(
            and(
                eq(users.tenantId, tenantResult.context.tenantId),
                eq(users.role, "employee")
            )
        )
        .orderBy(asc(users.status), asc(users.fullName), asc(users.email));

    return NextResponse.json({ data: rows });
}
