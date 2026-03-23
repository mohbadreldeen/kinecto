"use client";

import Link from "next/link";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
    useOwnerCampaignDetail,
    useProcessOwnerCampaignQueue,
    useSendOwnerCampaign,
} from "@/lib/hooks/use-owner-campaigns";
import { useLocale } from "@/lib/i18n/use-locale";

type Props = {
    campaignId: string;
};

function renderPreview(template: string) {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
        const placeholders: Record<string, string> = {
            customer_name: "Layla Hassan",
            first_name: "Layla",
            points: "245",
            business_name: "Your Business",
        };
        return placeholders[key] ?? `{{${key}}}`;
    });
}

function formatDate(value: string | null, locale: string) {
    if (!value) {
        return "-";
    }

    return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

export function OwnerCampaignDetail({ campaignId }: Props) {
    const queryClient = useQueryClient();
    const [sendError, setSendError] = useState<string | null>(null);
    const [queueError, setQueueError] = useState<string | null>(null);
    const [queueMessage, setQueueMessage] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const { locale, t } = useLocale();
    const campaignQuery = useOwnerCampaignDetail(campaignId);
    const sendMutation = useSendOwnerCampaign();
    const processQueueMutation = useProcessOwnerCampaignQueue();

    const canSendNow =
        campaignQuery.data?.status === "draft" ||
        campaignQuery.data?.status === "scheduled";

    async function handleConfirmSend() {
        setShowPreview(false);
        setSendError(null);

        try {
            await sendMutation.mutateAsync(campaignId);
            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: ["owner-campaigns", campaignId],
                }),
                queryClient.invalidateQueries({
                    queryKey: ["owner-campaigns"],
                }),
            ]);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : t("campaigns.sendError");
            setSendError(message);
        }
    }

    async function handleProcessQueueNow() {
        setQueueError(null);
        setQueueMessage(null);

        try {
            const result = await processQueueMutation.mutateAsync({
                campaignId,
                limit: Math.max(
                    1,
                    campaignQuery.data?.queueBreakdown.queuedDueNow ?? 1
                ),
            });

            setQueueMessage(
                `${t("campaigns.processedNow")} ${result.processed} ${t("campaigns.processedNowSuffix")}`
            );

            await Promise.all([
                queryClient.invalidateQueries({
                    queryKey: ["owner-campaigns", campaignId],
                }),
                queryClient.invalidateQueries({
                    queryKey: ["owner-campaigns"],
                }),
            ]);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : t("campaigns.processQueueError");
            setQueueError(message);
        }
    }

    return (
        <section className="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t("campaigns.detailEyebrow")}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">
                        {t("campaigns.detailTitle")}
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <Link
                        href="/campaigns"
                        className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500"
                    >
                        {t("campaigns.back")}
                    </Link>
                    <Link
                        href="/campaigns/new"
                        className="button rounded-md bg-(--brand-accent) px-3 py-2 text-md font-semibold text-white transition hover:opacity-90"
                    >
                        {t("campaigns.new")}
                    </Link>
                    <button
                        type="button"
                        onClick={() => setShowPreview(true)}
                        disabled={!canSendNow || sendMutation.isPending}
                        className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                        {sendMutation.isPending
                            ? t("campaigns.sending")
                            : t("campaigns.sendNow")}
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleProcessQueueNow()}
                        disabled={
                            processQueueMutation.isPending ||
                            !campaignQuery.data?.queueBreakdown.queuedDueNow
                        }
                        className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {processQueueMutation.isPending
                            ? t("campaigns.processing")
                            : t("campaigns.processNow")}
                    </button>
                </div>
            </div>

            {sendError ? (
                <p className="text-sm text-red-600">{sendError}</p>
            ) : null}

            {queueError ? (
                <p className="text-sm text-red-600">{queueError}</p>
            ) : null}

            {queueMessage ? (
                <p className="text-sm text-emerald-700">{queueMessage}</p>
            ) : null}

            {campaignQuery.data?.status === "sending" ? (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <span
                        className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent"
                        aria-hidden="true"
                    />
                    Sending campaign… stats will update automatically.
                    {t("campaigns.liveSending")}
                </div>
            ) : null}

            {campaignQuery.isLoading ? (
                <p className="text-sm text-slate-500">
                    {t("campaigns.loadingOne")}
                </p>
            ) : campaignQuery.error ? (
                <p className="text-sm text-red-600">
                    {campaignQuery.error.message}
                </p>
            ) : campaignQuery.data ? (
                <>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <h3 className="text-lg font-semibold text-slate-950">
                            {campaignQuery.data.name}
                        </h3>
                        <p className="mt-2 text-sm text-slate-600">
                            {t("campaigns.status")}:{" "}
                            <span className="capitalize">
                                {campaignQuery.data.status}
                            </span>
                        </p>
                        <p className="text-sm text-slate-600">
                            {t("campaigns.channel")}:{" "}
                            <span className="capitalize">
                                {campaignQuery.data.channel}
                            </span>
                        </p>
                        <p className="text-sm text-slate-600">
                            {t("campaigns.audience")}:{" "}
                            <span className="capitalize">
                                {campaignQuery.data.audienceType}
                            </span>
                            {campaignQuery.data.audienceSize !== null
                                ? ` (${campaignQuery.data.audienceSize} ${t("campaigns.audienceSelected")})`
                                : ""}
                        </p>
                        <p className="text-sm text-slate-600">
                            {t("campaigns.created")}:{" "}
                            {formatDate(campaignQuery.data.createdAt, locale)}
                        </p>
                        <p className="text-sm text-slate-600">
                            {t("campaigns.table.updated")}:{" "}
                            {formatDate(campaignQuery.data.updatedAt, locale)}
                        </p>
                        <p className="text-sm text-slate-600">
                            {t("campaigns.scheduled")}:{" "}
                            {formatDate(campaignQuery.data.scheduledAt, locale)}
                        </p>
                        <p className="text-sm text-slate-600">
                            {t("campaigns.sentAt")}:{" "}
                            {formatDate(campaignQuery.data.sentAt, locale)}
                        </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-4">
                        <div className="rounded-lg border border-slate-200 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                                {t("campaigns.queued")}
                            </p>
                            <p className="mt-2 text-2xl font-semibold text-slate-950">
                                {campaignQuery.data.stats.queued ?? 0}
                            </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                                {t("campaigns.table.sent")}
                            </p>
                            <p className="mt-2 text-2xl font-semibold text-slate-950">
                                {campaignQuery.data.stats.sent}
                            </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                                {t("campaigns.table.delivered")}
                            </p>
                            <p className="mt-2 text-2xl font-semibold text-slate-950">
                                {campaignQuery.data.stats.delivered}
                            </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 p-4">
                            <p className="text-xs uppercase tracking-wide text-slate-500">
                                {t("campaigns.table.failed")}
                            </p>
                            <p className="mt-2 text-2xl font-semibold text-slate-950">
                                {campaignQuery.data.stats.failed}
                            </p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {t("campaigns.queueVisibility")}
                        </p>
                        <p className="mt-2 text-sm text-slate-700">
                            {t("campaigns.dueNow")}:{" "}
                            {campaignQuery.data.queueBreakdown.queuedDueNow}
                        </p>
                        <p className="text-sm text-slate-700">
                            {t("campaigns.deferredRetries")}:{" "}
                            {campaignQuery.data.queueBreakdown.queuedDeferred}
                        </p>
                        <p className="text-sm text-slate-700">
                            {t("campaigns.nextRetry")}:{" "}
                            {formatDate(
                                campaignQuery.data.queueBreakdown.nextRetryAt,
                                locale
                            )}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                            {t("campaigns.lastRun")}:{" "}
                            {formatDate(
                                campaignQuery.data.lastQueueRun?.runAt ?? null,
                                locale
                            )}
                            {campaignQuery.data.lastQueueRun
                                ? ` · ${t("campaigns.lastRunStats")} ${campaignQuery.data.lastQueueRun.processed}, ${t("campaigns.lastRunSent")} ${campaignQuery.data.lastQueueRun.sent}, ${t("campaigns.lastRunFailed")} ${campaignQuery.data.lastQueueRun.failed}, ${t("campaigns.lastRunDeferred")} ${campaignQuery.data.lastQueueRun.deferred}`
                                : ""}
                        </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {t("campaigns.templateBody")}
                        </p>
                        <pre className="mt-2 whitespace-pre-wrap wrap-break-word rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                            {campaignQuery.data.templateBody}
                        </pre>
                    </div>
                </>
            ) : null}

            {/* Preview before send modal */}
            {showPreview && campaignQuery.data ? (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="preview-dialog-title"
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
                >
                    <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                        <h3
                            id="preview-dialog-title"
                            className="text-lg font-semibold text-slate-950"
                        >
                            {t("campaigns.previewTitle")}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                            {t("campaigns.previewCopy")}
                        </p>

                        <pre className="mt-4 whitespace-pre-wrap wrap-break-word rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                            {renderPreview(campaignQuery.data.templateBody)}
                        </pre>

                        <p className="mt-3 text-xs text-slate-500">
                            {t("campaigns.channel")}:{" "}
                            <span className="capitalize">
                                {campaignQuery.data.channel}
                            </span>{" "}
                            · {t("campaigns.audience")}:{" "}
                            <span className="capitalize">
                                {campaignQuery.data.audienceType}
                            </span>
                            {campaignQuery.data.audienceSize !== null
                                ? ` (${campaignQuery.data.audienceSize} ${t("campaigns.previewAudienceRecipients")})`
                                : ""}
                        </p>

                        <div className="mt-5 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowPreview(false)}
                                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                            >
                                {t("common.cancel")}
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmSend}
                                disabled={sendMutation.isPending}
                                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                                {sendMutation.isPending
                                    ? t("campaigns.sending")
                                    : t("campaigns.confirmSend")}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}
