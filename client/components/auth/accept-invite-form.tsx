"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

type Props = {
    token: string;
};

export function AcceptInviteForm({ token }: Props) {
    const router = useRouter();
    const [fullName, setFullName] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setError(null);

        const response = await fetch("/api/employees/invites/accept", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ token, fullName, password }),
        });

        const payload = (await response.json().catch(() => null)) as {
            data?: { email: string };
            error?: string;
        } | null;

        if (!response.ok || !payload?.data?.email) {
            setError(payload?.error ?? "Could not accept invitation");
            setSubmitting(false);
            return;
        }

        const supabase = createClient();
        const { data, error: signInError } =
            await supabase.auth.signInWithPassword({
                email: payload.data.email,
                password,
            });

        if (signInError) {
            setError(signInError.message);
            setSubmitting(false);
            return;
        }

        const role = data.user?.app_metadata.role;
        router.replace(role === "employee" ? "/employee" : "/dashboard");
        router.refresh();
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <label
                    htmlFor="fullName"
                    className="text-sm font-medium text-slate-700"
                >
                    Full name
                </label>
                <input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-950 outline-none transition focus:border-amber-500"
                />
            </div>
            <div className="space-y-2">
                <label
                    htmlFor="password"
                    className="text-sm font-medium text-slate-700"
                >
                    Password
                </label>
                <input
                    id="password"
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-950 outline-none transition focus:border-amber-500"
                />
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
                {submitting ? "Accepting..." : "Accept invite"}
            </button>
            <p className="text-sm text-slate-600">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-slate-900">
                    Sign in
                </Link>
            </p>
        </form>
    );
}
