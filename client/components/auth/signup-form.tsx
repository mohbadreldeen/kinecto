"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLocale } from "@/lib/i18n/use-locale";
import { createClient } from "@/lib/supabase/client";

export function SignupForm() {
    const router = useRouter();
    const { t } = useLocale();
    const [businessName, setBusinessName] = useState("");
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setError(null);

        const response = await fetch("/api/auth/signup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ businessName, fullName, email, password }),
        });

        const payload = (await response.json().catch(() => null)) as {
            error?: string;
        } | null;

        if (!response.ok) {
            setError(payload?.error ?? t("signup.failed"));
            setSubmitting(false);
            return;
        }

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
            <div className="space-y-2">
                <label
                    htmlFor="businessName"
                    className="text-sm font-medium text-slate-700"
                >
                    {t("signup.businessName")}
                </label>
                <input
                    id="businessName"
                    value={businessName}
                    onChange={(event) => setBusinessName(event.target.value)}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-amber-500"
                    placeholder="Northwind Cafe"
                />
            </div>
            <div className="space-y-2">
                <label
                    htmlFor="fullName"
                    className="text-sm font-medium text-slate-700"
                >
                    {t("signup.fullName")}
                </label>
                <input
                    id="fullName"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-amber-500"
                    placeholder="Amina Hassan"
                />
            </div>
            <div className="space-y-2">
                <label
                    htmlFor="email"
                    className="text-sm font-medium text-slate-700"
                >
                    {t("signup.workEmail")}
                </label>
                <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-amber-500"
                    placeholder="owner@northwind.local"
                />
            </div>
            <div className="space-y-2">
                <label
                    htmlFor="password"
                    className="text-sm font-medium text-slate-700"
                >
                    {t("signup.password")}
                </label>
                <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-amber-500"
                    placeholder={t("signup.passwordPlaceholder")}
                />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
                {submitting
                    ? t("signup.creatingWorkspace")
                    : t("signup.createWorkspace")}
            </button>
            <p className="text-sm text-slate-600">
                {t("signup.alreadyHaveAccess")}{" "}
                <Link href="/login" className="font-medium text-slate-950">
                    {t("login.signIn")}
                </Link>
            </p>
        </form>
    );
}
