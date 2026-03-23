import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";

const paramsSchema = z.object({
    id: z.string().uuid(),
});

const updateEmployeeSchema = z.object({
    status: z.enum(["active", "inactive"]),
});

async function getEmployeeForTenant(tenantId: string, employeeId: string) {
    return db.query.users.findFirst({
        where: and(
            eq(users.id, employeeId),
            eq(users.tenantId, tenantId),
            eq(users.role, "employee")
        ),
    });
}

export async function PATCH(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    if (tenantResult.context.role !== "owner") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = await context.params;
    const parsedParams = paramsSchema.safeParse(params);
    if (!parsedParams.success) {
        return NextResponse.json(
            {
                error: "Invalid employee id",
                details: parsedParams.error.flatten(),
            },
            { status: 400 }
        );
    }

    const json = await request.json().catch(() => null);
    const parsedBody = updateEmployeeSchema.safeParse(json);
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: "Invalid payload",
                details: parsedBody.error.flatten(),
            },
            { status: 400 }
        );
    }

    const employee = await getEmployeeForTenant(
        tenantResult.context.tenantId,
        parsedParams.data.id
    );

    if (!employee) {
        return NextResponse.json(
            { error: "Employee not found" },
            { status: 404 }
        );
    }

    const [updated] = await db
        .update(users)
        .set({
            status: parsedBody.data.status,
            updatedAt: new Date(),
        })
        .where(eq(users.id, employee.id))
        .returning({
            id: users.id,
            email: users.email,
            fullName: users.fullName,
            status: users.status,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
        });

    return NextResponse.json({ data: updated });
}

export async function DELETE(
    _request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    if (tenantResult.context.role !== "owner") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = await context.params;
    const parsedParams = paramsSchema.safeParse(params);
    if (!parsedParams.success) {
        return NextResponse.json(
            {
                error: "Invalid employee id",
                details: parsedParams.error.flatten(),
            },
            { status: 400 }
        );
    }

    const employee = await getEmployeeForTenant(
        tenantResult.context.tenantId,
        parsedParams.data.id
    );

    if (!employee) {
        return NextResponse.json(
            { error: "Employee not found" },
            { status: 404 }
        );
    }

    await db.delete(users).where(eq(users.id, employee.id));

    try {
        const admin = createAdminClient();
        await admin.auth.admin.deleteUser(employee.authUserId);
    } catch {
        // Access is revoked by removing tenant membership even if auth cleanup fails.
    }

    return new NextResponse(null, { status: 204 });
}
