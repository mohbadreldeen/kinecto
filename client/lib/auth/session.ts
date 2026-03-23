import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { tenants, users } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "owner" | "employee";

export async function getInactiveSessionNotice(noticeMessage?: string) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    const tenantId = user.app_metadata.tenantId as string | undefined;
    if (!tenantId) {
        return null;
    }

    const membership = await db.query.users.findFirst({
        where: and(
            eq(users.authUserId, user.id),
            eq(users.tenantId, tenantId),
            eq(users.status, "inactive")
        ),
        columns: {
            id: true,
        },
    });

    if (!membership) {
        return null;
    }

    return (
        noticeMessage ??
        "Your account has been temporarily disabled. Please contact your workspace owner to restore access."
    );
}

export async function getCurrentSessionContext() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    const tenantId = user.app_metadata.tenantId as string | undefined;
    const role = user.app_metadata.role as AppRole | undefined;

    if (!tenantId || !role) {
        return null;
    }

    const membership = await db.query.users.findFirst({
        where: and(eq(users.authUserId, user.id), eq(users.status, "active")),
    });

    if (!membership || membership.tenantId !== tenantId) {
        return null;
    }

    const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
    });

    if (!tenant) {
        return null;
    }

    return {
        user,
        role,
        tenant,
        membership,
    };
}

export async function requireSessionContext(requiredRole?: AppRole) {
    const context = await getCurrentSessionContext();

    if (!context) {
        redirect("/login");
    }

    if (requiredRole && context.role !== requiredRole) {
        redirect(context.role === "owner" ? "/dashboard" : "/employee");
    }

    return context;
}
