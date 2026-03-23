import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

const tenantIdSchema = z.string().uuid();

export type TenantContext = {
    tenantId: string;
    authUserId: string;
    userId: string;
    role: "owner" | "employee";
    email: string;
};

export async function requireTenantContext(): Promise<
    { context: TenantContext } | { response: NextResponse }
> {
    const supabase = await createClient();
    const {
        data: { user },
        error,
    } = await supabase.auth.getUser();

    if (error || !user) {
        return {
            response: NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            ),
        };
    }

    const parsedTenantId = tenantIdSchema.safeParse(
        user.app_metadata?.tenantId
    );
    if (!parsedTenantId.success) {
        return {
            response: NextResponse.json(
                { error: "Missing tenant context in auth token" },
                { status: 403 }
            ),
        };
    }

    const [membership] = await db
        .select({
            id: users.id,
            role: users.role,
            email: users.email,
        })
        .from(users)
        .where(
            and(
                eq(users.authUserId, user.id),
                eq(users.tenantId, parsedTenantId.data),
                eq(users.status, "active")
            )
        )
        .limit(1);

    if (!membership) {
        return {
            response: NextResponse.json(
                { error: "User is not active for this tenant" },
                { status: 403 }
            ),
        };
    }

    return {
        context: {
            tenantId: parsedTenantId.data,
            authUserId: user.id,
            userId: membership.id,
            role: membership.role,
            email: membership.email,
        },
    };
}
