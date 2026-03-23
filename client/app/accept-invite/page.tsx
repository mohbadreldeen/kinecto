import Link from "next/link";

import { AcceptInviteForm } from "@/components/auth/accept-invite-form";

type PageProps = {
    searchParams: Promise<{ token?: string }>;
};

export default async function AcceptInvitePage({ searchParams }: PageProps) {
    const params = await searchParams;
    const token = params.token;

    if (!token) {
        return (
            <main className="auth-shell">
                <section className="auth-card">
                    <div className="space-y-3">
                        <p className="eyebrow">Invitation</p>
                        <h1 className="auth-title">Missing invite token</h1>
                        <p className="auth-copy">
                            Ask your manager to send the invite link again.
                        </p>
                        <Link
                            href="/login"
                            className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                        >
                            Back to login
                        </Link>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main className="auth-shell">
            <section className="auth-card auth-card-wide">
                <div className="space-y-3">
                    <p className="eyebrow">Team invite</p>
                    <h1 className="auth-title">Join your workspace</h1>
                    <p className="auth-copy">
                        Complete your employee account setup to access the
                        frontline console.
                    </p>
                </div>
                <AcceptInviteForm token={token} />
            </section>
        </main>
    );
}
