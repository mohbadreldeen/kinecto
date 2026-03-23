"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLocale } from "@/lib/i18n/use-locale";
import { createClient } from "@/lib/supabase/client";

type Props = {
    inactiveNotice?: string | null;
};

export function LoginForm({ inactiveNotice = null }: Props) {
    const router = useRouter();
    const { t } = useLocale();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setError(null);

        const supabase = createClient();
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setSubmitting(false);
            return;
        }

        const role = data.user?.app_metadata.role;
        router.replace(role === "employee" ? "/employee" : "/dashboard");
        router.refresh();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {inactiveNotice ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {inactiveNotice}
                </div>
            ) : null}
            <div className="space-y-2">
                <label
                    htmlFor="email"
                    className="text-sm font-medium text-slate-700"
                >
                    {t("login.workEmail")}
                </label>
                <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-amber-500"
                    placeholder="owner@kinecto.local"
                />
            </div>
            <div className="space-y-2">
                <label
                    htmlFor="password"
                    className="text-sm font-medium text-slate-700"
                >
                    {t("login.password")}
                </label>
                <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-amber-500"
                    placeholder="••••••••"
                />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
                {submitting ? t("login.signingIn") : t("login.signIn")}
            </button>
            <div className="flex items-center justify-between text-sm text-slate-600">
                <Link href="/signup" className="hover:text-slate-950">
                    {t("login.createAccount")}
                </Link>
                <Link href="/reset-password" className="hover:text-slate-950">
                    {t("login.resetPassword")}
                </Link>
            </div>
        </form>
    );
}
