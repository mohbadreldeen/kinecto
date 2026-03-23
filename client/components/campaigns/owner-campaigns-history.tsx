"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
    useOwnerCampaigns,
    useProcessAllOwnerCampaignsQueue,
} from "@/lib/hooks/use-owner-campaigns";
import { useLocale } from "@/lib/i18n/use-locale";

function formatDate(value: string, locale: string) {
    return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

function formatETA(nextRetryAt: string): string {
    const now = new Date();
    const retryTime = new Date(nextRetryAt);
    const diffMs = retryTime.getTime() - now.getTime();

    if (diffMs <= 0) {
        return "Due now";
    }

    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
        return `${diffDays}d ${diffHours % 24}h`;
    }
    if (diffHours > 0) {
        return `${diffHours}h ${diffMins % 60}m`;
    }
    if (diffMins > 0) {
        return `${diffMins}m`;
    }
    return `${Math.max(1, diffSecs)}s`;
}

function isQueueRecovering(campaign: {
    lastQueueRun?: { rateLimited: boolean } | null;
    queueBreakdown: { nextRetryAt: string | null };
}): boolean {
    if (!campaign.lastQueueRun?.rateLimited) {
        return false;
    }
    if (!campaign.queueBreakdown.nextRetryAt) {
        return false;
    }
    const nextRetryTime = new Date(campaign.queueBreakdown.nextRetryAt);
    return nextRetryTime.getTime() > Date.now();
}

export function OwnerCampaignsHistory() {
    const campaignsQuery = useOwnerCampaigns();
    const processAllQueueMutation = useProcessAllOwnerCampaignsQueue();
    const queryClient = useQueryClient();
    const [refreshKey, setRefreshKey] = useState(0);
    const [feedbackMessage, setFeedbackMessage] = useState<{
        type: "success" | "error";
        text: string;
    } | null>(null);
    const { locale, t } = useLocale();

    // Refresh component every 60 seconds to update ETA countdowns
    useEffect(() => {
        const interval = setInterval(() => {
            setRefreshKey((prev) => prev + 1);
        }, 60_000);

        return () => clearInterval(interval);
    }, []);

    async function handleProcessAllQueues() {
        try {
            setFeedbackMessage(null);
            const result = await processAllQueueMutation.mutateAsync({});
            setFeedbackMessage({
                type: "success",
                text: `${t("campaigns.processedSummary")}: ${result.totalSent} ${t("campaigns.table.sent").toLowerCase()}, ${result.totalFailed} ${t("campaigns.table.failed").toLowerCase()}, ${result.campaignsRateLimited} ${t("campaigns.queueRateLimited").toLowerCase()}`,
            });
            // Invalidate both campaign list and detail queries to refresh UI
            await queryClient.invalidateQueries({
                queryKey: ["owner-campaigns"],
            });
            await queryClient.invalidateQueries({
                queryKey: ["owner-campaign-detail"],
            });
        } catch (error) {
            setFeedbackMessage({
                type: "error",
                text:
                    error instanceof Error
                        ? error.message
                        : t("campaigns.processFailed"),
            });
        }
    }

    return (
        <section className="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {t("campaigns.historyEyebrow")}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">
                        {t("campaigns.historyTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                        {t("campaigns.historySubtitle")}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleProcessAllQueues}
                        disabled={
                            processAllQueueMutation.isPending ||
                            (campaignsQuery.data?.length ?? 0) === 0
                        }
                        className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition enabled:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {processAllQueueMutation.isPending
                            ? t("campaigns.processing")
                            : t("campaigns.processAll")}
                    </button>
                    <Link
                        href="/campaigns/new"
                        className="button rounded-md  bg-(--brand-accent) px-3 py-2 text-md font-semibold text-white transition hover:bg-slate-800"
                    >
                        {t("campaigns.new")}
                    </Link>
                </div>
            </div>

            {feedbackMessage && (
                <div
                    className={`rounded-md px-4 py-3 text-sm ${
                        feedbackMessage.type === "success"
                            ? "bg-green-50 text-green-800 border border-green-200"
                            : "bg-red-50 text-red-800 border border-red-200"
                    }`}
                >
                    {feedbackMessage.text}
                </div>
            )}

            {campaignsQuery.isLoading ? (
                <p className="text-sm text-slate-500">
                    {t("campaigns.loading")}
                </p>
            ) : campaignsQuery.error ? (
                <p className="text-sm text-red-600">
                    {campaignsQuery.error.message}
                </p>
            ) : campaignsQuery.data && campaignsQuery.data.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-4 py-3">Campaign</th>
                                <th className="px-4 py-3">
                                    {t("campaigns.table.channel")}
                                </th>
                                <th className="px-4 py-3">
                                    {t("campaigns.table.audience")}
                                </th>
                                <th className="px-4 py-3">
                                    {t("campaigns.table.status")}
                                </th>
                                <th className="px-4 py-3">
                                    {t("campaigns.table.queue")}
                                </th>
                                <th className="px-4 py-3">
                                    {t("campaigns.table.sent")}
                                </th>
                                <th className="px-4 py-3">
                                    {t("campaigns.table.delivered")}
                                </th>
                                <th className="px-4 py-3">
                                    {t("campaigns.table.failed")}
                                </th>
                                <th className="px-4 py-3">
                                    {t("campaigns.table.updated")}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {campaignsQuery.data.map((campaign) => (
                                <tr key={campaign.id}>
                                    <td className="px-4 py-3 text-slate-900">
                                        <Link
                                            href={`/campaigns/${campaign.id}`}
                                            className="font-semibold text-slate-900 transition hover:text-amber-700"
                                        >
                                            {campaign.name}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 capitalize text-slate-700">
                                        {campaign.channel}
                                    </td>
                                    <td className="px-4 py-3 capitalize text-slate-700">
                                        {campaign.audienceType}
                                    </td>
                                    <td className="px-4 py-3 capitalize text-slate-700">
                                        {campaign.status}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-2">
                                            {campaign.queueBreakdown
                                                .queuedDueNow > 0 && (
                                                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                                                    {
                                                        campaign.queueBreakdown
                                                            .queuedDueNow
                                                    }{" "}
                                                    {t("campaigns.queueDue")}
                                                </span>
                                            )}
                                            {campaign.queueBreakdown
                                                .queuedDeferred > 0 && (
                                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                                                    {
                                                        campaign.queueBreakdown
                                                            .queuedDeferred
                                                    }{" "}
                                                    {t(
                                                        "campaigns.queueDeferred"
                                                    )}
                                                </span>
                                            )}
                                            {isQueueRecovering(campaign) ? (
                                                <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                                                    🔄{" "}
                                                    {t(
                                                        "campaigns.queueRecovering"
                                                    )}
                                                </span>
                                            ) : campaign.lastQueueRun
                                                  ?.rateLimited ? (
                                                <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                                                    ⚠{" "}
                                                    {t(
                                                        "campaigns.queueRateLimited"
                                                    )}
                                                </span>
                                            ) : null}
                                            {campaign.queueBreakdown
                                                .nextRetryAt && (
                                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                                                    {t("campaigns.queueEta")}:{" "}
                                                    {formatETA(
                                                        campaign.queueBreakdown
                                                            .nextRetryAt
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">
                                        {campaign.stats.sent}
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">
                                        {campaign.stats.delivered}
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">
                                        {campaign.stats.failed}
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">
                                        {formatDate(campaign.updatedAt, locale)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <p className="text-sm text-slate-600">
                        {t("campaigns.none")}
                    </p>
                </div>
            )}
        </section>
    );
}
