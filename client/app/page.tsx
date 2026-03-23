import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSessionContext } from "@/lib/auth/session";

export default async function Home() {
    const context = await getCurrentSessionContext();

    if (context) {
        redirect(context.role === "employee" ? "/employee" : "/dashboard");
    }

    return (
        <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.24),_transparent_32%),radial-gradient(circle_at_80%_20%,_rgba(15,118,110,0.16),_transparent_28%),linear-gradient(180deg,_#fff8ef_0%,_#ffffff_52%,_#f8fafc_100%)] px-6 py-8 text-slate-950">
            <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col justify-between gap-10 rounded-[2.5rem] border border-white/70 bg-white/65 p-8 shadow-[0_40px_120px_rgba(15,23,42,0.10)] backdrop-blur md:p-12">
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-4">
                        <p className="eyebrow">Kinecto SaaS</p>
                        <h1 className="max-w-3xl font-display text-5xl leading-[1.05] tracking-tight text-slate-950 md:text-7xl">
                            Loyalty operations that stay tenant-safe from
                            sign-up to API access.
                        </h1>
                        <p className="max-w-2xl text-lg leading-8 text-slate-600">
                            Milestone 1 now covers owner onboarding,
                            employee-aware route protection, session-backed
                            dashboards, and an installable app shell for kiosk
                            and staff devices.
                        </p>
                    </div>
                    <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950 shadow-sm">
                        <p className="font-semibold">Milestone 1 status</p>
                        <p className="mt-2 max-w-xs leading-6 text-amber-900/80">
                            Auth, onboarding, protected routes, TanStack Query
                            bootstrap, Zustand state, and PWA registration are
                            all connected.
                        </p>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
                    <div className="grid gap-6 md:grid-cols-3">
                        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                            <p className="text-sm font-medium text-slate-500">
                                Owner onboarding
                            </p>
                            <p className="mt-3 text-2xl font-semibold">
                                Tenant + auth user
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                A single sign-up call provisions the tenant
                                record, owner membership, and Supabase auth
                                profile with app metadata.
                            </p>
                        </article>
                        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                            <p className="text-sm font-medium text-slate-500">
                                Access control
                            </p>
                            <p className="mt-3 text-2xl font-semibold">
                                Role-routed UX
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Owners land in the management dashboard.
                                Employees are isolated in a separate frontline
                                workspace with route-level redirects.
                            </p>
                        </article>
                        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                            <p className="text-sm font-medium text-slate-500">
                                Installable shell
                            </p>
                            <p className="mt-3 text-2xl font-semibold">
                                PWA-ready
                            </p>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Manifest metadata and service worker
                                registration are in place for mobile and
                                kiosk-style launch surfaces.
                            </p>
                        </article>
                    </div>

                    <aside className="flex flex-col justify-between rounded-[2rem] bg-slate-950 p-7 text-white shadow-[0_25px_60px_rgba(15,23,42,0.24)]">
                        <div>
                            <p className="eyebrow text-amber-300">Start here</p>
                            <h2 className="mt-3 font-display text-3xl leading-tight">
                                Create the first tenant or sign back in.
                            </h2>
                            <p className="mt-4 text-sm leading-7 text-slate-300">
                                This slice is ready to validate Milestone 1
                                flows against your local Supabase stack.
                            </p>
                        </div>
                        <div className="mt-8 flex flex-col gap-3">
                            <Link
                                href="/signup"
                                className="rounded-full bg-amber-400 px-5 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
                            >
                                Create workspace
                            </Link>
                            <Link
                                href="/login"
                                className="rounded-full border border-slate-700 px-5 py-3 text-center text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-white/5"
                            >
                                Sign in
                            </Link>
                        </div>
                    </aside>
                </div>
            </section>
        </main>
    );
}
