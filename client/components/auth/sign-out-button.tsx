"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLocale } from "@/lib/i18n/use-locale";
import { createClient } from "@/lib/supabase/client";
import { useTenantStore } from "@/lib/store/use-tenant-store";

export function SignOutButton() {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const clearTenant = useTenantStore((state) => state.clear);
    const { t } = useLocale();

    async function handleSignOut() {
        setSubmitting(true);
        const supabase = createClient();
        await supabase.auth.signOut();
        clearTenant();
        router.replace("/login");
        router.refresh();
    }

    return (
        <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={submitting}
            className="button rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-500 hover:text-slate-950 disabled:opacity-60"
        >
            {submitting ? t("action.signingOut") : t("action.signOut")}
        </button>
    );
}
