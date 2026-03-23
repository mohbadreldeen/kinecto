"use client";

import Link from "next/link";
import { useState } from "react";

import { useLocale } from "@/lib/i18n/use-locale";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
    const { t } = useLocale();
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setMessage(null);
        setError(null);

        const supabase = createClient();
        const redirectTo = `${window.location.origin}/login`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo,
        });

        if (error) {
            setError(error.message);
            setSubmitting(false);
            return;
        }

        setMessage(t("reset.sent"));
        setSubmitting(false);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
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
            {message ? (
                <p className="text-sm text-emerald-700">{message}</p>
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
                {submitting ? t("reset.sending") : t("reset.sendEmail")}
            </button>
            <p className="text-sm text-slate-600">
                {t("reset.backTo")}{" "}
                <Link href="/login" className="font-medium text-slate-950">
                    {t("login.signIn")}
                </Link>
            </p>
        </form>
    );
}
