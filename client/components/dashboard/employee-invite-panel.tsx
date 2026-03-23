"use client";

import { useState } from "react";

import {
    useCreateEmployeeInvite,
    useEmployeeInvites,
    useResendEmployeeInvite,
    useRevokeEmployeeInvite,
} from "@/lib/hooks/use-employee-invites";
import { useLocale } from "@/lib/i18n/use-locale";

export function EmployeeInvitePanel() {
    const [email, setEmail] = useState("");
    const [fullName, setFullName] = useState("");
    const [inviteLink, setInviteLink] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [resendId, setResendId] = useState<string | null>(null);

    const invitesQuery = useEmployeeInvites();
    const createInvite = useCreateEmployeeInvite();
    const resendInvite = useResendEmployeeInvite();
    const revokeInvite = useRevokeEmployeeInvite();
    const { locale, t } = useLocale();

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        try {
            const result = await createInvite.mutateAsync({
                email,
                fullName: fullName || undefined,
            });

            setInviteLink(result.inviteUrl);
            setEmail("");
            setFullName("");
        } catch (mutationError) {
            setError(
                mutationError instanceof Error
                    ? mutationError.message
                    : t("invite.createError")
            );
        }
    }

    async function handleResend(inviteId: string) {
        setActionError(null);
        setResendId(inviteId);

        try {
            const result = await resendInvite.mutateAsync(inviteId);
            setInviteLink(result.inviteUrl);
        } catch (mutationError) {
            setActionError(
                mutationError instanceof Error
                    ? mutationError.message
                    : t("invite.resendError")
            );
        } finally {
            setResendId(null);
        }
    }

    async function handleRevoke(inviteId: string) {
        setActionError(null);

        try {
            await revokeInvite.mutateAsync(inviteId);
        } catch (mutationError) {
            setActionError(
                mutationError instanceof Error
                    ? mutationError.message
                    : t("invite.revokeError")
            );
        }
    }

    return (
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">
                {t("invite.employeeTitle")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
                {t("invite.employeeSubtitle")}
            </p>

            <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
                <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder={t("invite.emailPlaceholder")}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-(--brand-accent)"
                />
                <input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder={t("invite.namePlaceholder")}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-(--brand-accent)"
                />
                <button
                    type="submit"
                    disabled={createInvite.isPending}
                    className="rounded-full bg-(--brand-accent) px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                >
                    {createInvite.isPending
                        ? t("invite.creating")
                        : t("invite.create")}
                </button>
            </form>

            {inviteLink ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                        {t("invite.link")}
                    </p>
                    <input
                        readOnly
                        value={inviteLink}
                        aria-label="Employee invite link"
                        className="mt-2 w-full rounded-md border border-emerald-200 bg-white px-2 py-1 text-sm text-emerald-900"
                    />
                </div>
            ) : null}

            {error ? (
                <p className="mt-3 text-sm text-red-600">{error}</p>
            ) : null}

            {actionError ? (
                <p className="mt-3 text-sm text-red-600">{actionError}</p>
            ) : null}

            <div className="mt-5 space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">
                    {t("invite.recent")}
                </h3>
                {invitesQuery.isLoading ? (
                    <p className="text-sm text-slate-500">
                        {t("invite.loading")}
                    </p>
                ) : invitesQuery.error ? (
                    <p className="text-sm text-red-600">
                        {t("invite.loadError")}
                    </p>
                ) : invitesQuery.data && invitesQuery.data.length > 0 ? (
                    invitesQuery.data.map((invite) => (
                        <article
                            key={invite.id}
                            className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
                        >
                            <div className="flex-1">
                                <p className="text-sm font-medium text-slate-900">
                                    {invite.email}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                    {invite.acceptedAt
                                        ? t("invite.accepted")
                                        : invite.isExpired
                                          ? t("invite.expired")
                                          : `${t("invite.expires")} ${new Date(invite.expiresAt).toLocaleString(locale)}`}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                {!invite.acceptedAt && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleResend(invite.id)
                                            }
                                            disabled={
                                                resendInvite.isPending ||
                                                resendId === invite.id
                                            }
                                            className="rounded-md bg-(--brand-accent) px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
                                        >
                                            {resendId === invite.id
                                                ? t("invite.resending")
                                                : t("invite.resend")}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleRevoke(invite.id)
                                            }
                                            disabled={revokeInvite.isPending}
                                            className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
                                        >
                                            {revokeInvite.isPending
                                                ? t("invite.revoking")
                                                : t("invite.revoke")}
                                        </button>
                                    </>
                                )}
                            </div>
                        </article>
                    ))
                ) : (
                    <p className="text-sm text-slate-500">{t("invite.none")}</p>
                )}
            </div>
        </section>
    );
}
