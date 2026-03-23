import { and, eq, isNull } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { generateInviteToken, hashInviteToken } from "@/lib/auth/invite-token";
import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import { employeeInvites } from "@/lib/db/schema";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    if (tenantResult.context.role !== "owner") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const invite = await db.query.employeeInvites.findFirst({
        where: and(
            eq(employeeInvites.id, id),
            eq(employeeInvites.tenantId, tenantResult.context.tenantId)
        ),
    });

    if (!invite) {
        return NextResponse.json(
            { error: "Invitation not found" },
            { status: 404 }
        );
    }

    await db.delete(employeeInvites).where(eq(employeeInvites.id, id));

    return NextResponse.json({ success: true });
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    if (tenantResult.context.role !== "owner") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;

    const invite = await db.query.employeeInvites.findFirst({
        where: and(
            eq(employeeInvites.id, id),
            eq(employeeInvites.tenantId, tenantResult.context.tenantId),
            isNull(employeeInvites.acceptedAt)
        ),
    });

    if (!invite) {
        return NextResponse.json(
            { error: "Invitation not found or already accepted" },
            { status: 404 }
        );
    }

    const token = generateInviteToken();
    const tokenHash = hashInviteToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const [updated] = await db
        .update(employeeInvites)
        .set({
            tokenHash,
            expiresAt,
            updatedAt: new Date(),
        })
        .where(eq(employeeInvites.id, id))
        .returning({
            id: employeeInvites.id,
            email: employeeInvites.email,
            fullName: employeeInvites.fullName,
            expiresAt: employeeInvites.expiresAt,
            createdAt: employeeInvites.createdAt,
        });

    const origin = request.nextUrl.origin;

    return NextResponse.json(
        {
            data: updated,
            inviteUrl: `${origin}/accept-invite?token=${token}`,
        },
        { status: 200 }
    );
}
