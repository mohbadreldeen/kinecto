"use client";

import Link from "next/link";
import { useState } from "react";

import { useLocale } from "@/lib/i18n/use-locale";
import {
    usePassKitIntegrationSettings,
    useSavePassKitIntegrationSettings,
} from "@/lib/hooks/use-passkit-integration";

export function PassKitIntegrationForm() {
    const { t } = useLocale();
    const settingsQuery = usePassKitIntegrationSettings();
    const saveMutation = useSavePassKitIntegrationSettings();

    const [draft, setDraft] = useState<{
        label?: string;
        baseUrl?: string;
        templateId?: string;
    }>({});
    const [apiKey, setApiKey] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const label = draft.label ?? settingsQuery.data?.label ?? "";
    const baseUrl = draft.baseUrl ?? settingsQuery.data?.baseUrl ?? "";
    const templateId = draft.templateId ?? settingsQuery.data?.templateId ?? "";

    async function handleSave() {
        setError(null);
        setSuccess(null);

        const trimmedBaseUrl = baseUrl.trim();
        const trimmedTemplateId = templateId.trim();
        const trimmedApiKey = apiKey.trim();

        if (!trimmedBaseUrl || !trimmedTemplateId || !trimmedApiKey) {
            setError(t("settings.passkitValidation"));
            return;
        }

        try {
            await saveMutation.mutateAsync({
                label: label.trim() || undefined,
                baseUrl: trimmedBaseUrl,
                templateId: trimmedTemplateId,
                apiKey: trimmedApiKey,
            });

            setApiKey("");
            setDraft({});
            setSuccess(t("settings.passkitSaved"));
            await settingsQuery.refetch();
        } catch (mutationError) {
            setError(
                mutationError instanceof Error
                    ? mutationError.message
                    : t("settings.passkitSaveError")
            );
        }
    }

    return (
        <section className="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t("settings.section")}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">
                        {t("settings.integrations.passkitTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                        {t("settings.integrations.passkitSubtitle")}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/wallet"
                        className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                    >
                        {t("settings.walletPage")}
                    </Link>
                </div>
            </div>

            {settingsQuery.isLoading ? (
                <p className="text-sm text-slate-500">
                    {t("settings.loading")}
                </p>
            ) : settingsQuery.error ? (
                <p className="text-sm text-red-600">
                    {settingsQuery.error.message}
                </p>
            ) : (
                <>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        <p>
                            {t("settings.configured")}:{" "}
                            {settingsQuery.data?.configured
                                ? t("common.yes")
                                : t("common.no")}
                        </p>
                        <p>
                            {t("settings.savedApiKey")}:{" "}
                            {settingsQuery.data?.apiKeyMasked || "-"}
                        </p>
                    </div>

                    <div className="grid gap-3">
                        <input
                            value={label}
                            onChange={(event) =>
                                setDraft((current) => ({
                                    ...current,
                                    label: event.target.value,
                                }))
                            }
                            placeholder={t("settings.labelOptional")}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                        />
                        <input
                            value={baseUrl}
                            onChange={(event) =>
                                setDraft((current) => ({
                                    ...current,
                                    baseUrl: event.target.value,
                                }))
                            }
                            placeholder={t("settings.passkitBaseUrl")}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                        />
                        <input
                            value={templateId}
                            onChange={(event) =>
                                setDraft((current) => ({
                                    ...current,
                                    templateId: event.target.value,
                                }))
                            }
                            placeholder={t("settings.templateId")}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                        />
                        <input
                            value={apiKey}
                            onChange={(event) => setApiKey(event.target.value)}
                            placeholder={t("settings.apiKey")}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saveMutation.isPending}
                        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                    >
                        {saveMutation.isPending
                            ? t("settings.saving")
                            : t("settings.saveSettings")}
                    </button>
                </>
            )}

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {success ? (
                <p className="text-sm text-emerald-700">{success}</p>
            ) : null}
        </section>
    );
}
