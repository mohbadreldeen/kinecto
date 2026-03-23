"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

export type OwnerCampaignStats = {
    queued: number;
    sent: number;
    delivered: number;
    failed: number;
};

export type OwnerCampaign = {
    id: string;
    name: string;
    channel: "whatsapp" | "email";
    audienceType: "all" | "segment" | "manual";
    status: "draft" | "scheduled" | "sending" | "sent" | "failed";
    stats: OwnerCampaignStats;
    queueBreakdown: {
        queuedDueNow: number;
        queuedDeferred: number;
        nextRetryAt: string | null;
    };
    lastQueueRun?: {
        runAt: string;
        processed: number;
        sent: number;
        failed: number;
        deferred: number;
        rateLimited: boolean;
        retryAfterSeconds: number | null;
    } | null;
    createdAt: string;
    updatedAt: string;
};

export type OwnerCampaignDetail = OwnerCampaign & {
    templateBody: string;
    audienceCriteria: Record<string, unknown>;
    scheduledAt: string | null;
    sentAt: string | null;
    audienceSize: number | null;
    lastQueueRun: {
        runAt: string;
        processed: number;
        sent: number;
        failed: number;
        deferred: number;
        rateLimited: boolean;
        retryAfterSeconds: number | null;
    } | null;
    queueBreakdown: {
        queuedDueNow: number;
        queuedDeferred: number;
        nextRetryAt: string | null;
    };
};

export type CampaignAudiencePreviewCustomer = {
    id: string;
    name: string;
    phone: string;
    pointsBalance: number;
    status: "active" | "inactive";
};

export type CreateOwnerCampaignPayload = {
    name: string;
    channel: "whatsapp" | "email";
    templateBody: string;
    audienceType: "all" | "segment" | "manual";
    audienceCriteria: Record<string, unknown>;
};

export type SendOwnerCampaignResult = {
    campaignId: string;
    status: "sending" | "failed";
    queued: number;
    failed: number;
};

export type ProcessOwnerCampaignQueuePayload = {
    campaignId: string;
    limit?: number;
};

export type ProcessOwnerCampaignQueueResult = {
    tenantId: string;
    processed: number;
    sent: number;
    failed: number;
    deferred: number;
    rateLimited: boolean;
    retryAfterSeconds: number | null;
    campaignsUpdated: number;
};

export type ProcessAllCampaignsQueueResult = {
    tenantId: string;
    processCampaigns: number;
    totalProcessed: number;
    totalSent: number;
    totalFailed: number;
    totalDeferred: number;
    campaignsRateLimited: number;
    campaignResults: Array<{
        campaignId: string;
        processed: number;
        sent: number;
        failed: number;
        deferred: number;
        rateLimited: boolean;
    }>;
};

async function fetchOwnerCampaigns() {
    const response = await fetch("/api/campaigns", {
        method: "GET",
        credentials: "include",
    });

    const payload = (await response.json().catch(() => null)) as {
        data?: OwnerCampaign[];
        error?: string;
    } | null;

    if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Could not load campaigns");
    }

    return payload.data;
}

async function fetchOwnerCampaignDetail(campaignId: string) {
    const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "GET",
        credentials: "include",
    });

    const payload = (await response.json().catch(() => null)) as {
        data?: OwnerCampaignDetail;
        error?: string;
    } | null;

    if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Could not load campaign detail");
    }

    return payload.data;
}

async function fetchCampaignAudiencePreview(selectedIds: string[]) {
    const params = new URLSearchParams();
    selectedIds.forEach((id) => params.append("selectedIds", id));

    const response = await fetch(
        `/api/campaigns/audience-preview?${params.toString()}`,
        {
            method: "GET",
            credentials: "include",
        }
    );

    const payload = (await response.json().catch(() => null)) as {
        data?: CampaignAudiencePreviewCustomer[];
        error?: string;
    } | null;

    if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Could not load selected audience");
    }

    return payload.data;
}

async function createOwnerCampaign(payload: CreateOwnerCampaignPayload) {
    const response = await fetch("/api/campaigns", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const json = (await response.json().catch(() => null)) as {
        data?: { id: string };
        error?: string;
    } | null;

    if (!response.ok || !json?.data) {
        throw new Error(json?.error ?? "Could not create campaign draft");
    }

    return json.data;
}

async function sendOwnerCampaign(campaignId: string) {
    const response = await fetch(`/api/campaigns/${campaignId}/send`, {
        method: "POST",
        credentials: "include",
    });

    const json = (await response.json().catch(() => null)) as {
        data?: SendOwnerCampaignResult;
        error?: string;
    } | null;

    if (!response.ok || !json?.data) {
        throw new Error(json?.error ?? "Could not send campaign");
    }

    return json.data;
}

async function processOwnerCampaignQueue(
    payload: ProcessOwnerCampaignQueuePayload
) {
    const response = await fetch("/api/messaging/process-queue", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            campaignId: payload.campaignId,
            limit: payload.limit,
        }),
    });

    const json = (await response.json().catch(() => null)) as {
        data?: ProcessOwnerCampaignQueueResult;
        error?: string;
    } | null;

    if (!response.ok || !json?.data) {
        throw new Error(json?.error ?? "Could not process queue");
    }

    return json.data;
}

async function processAllOwnerCampaignsQueue(payload: { limit?: number }) {
    const response = await fetch("/api/messaging/process-queue", {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            processAllCampaigns: true,
            limit: payload.limit,
        }),
    });

    const json = (await response.json().catch(() => null)) as {
        data?: ProcessAllCampaignsQueueResult;
        error?: string;
    } | null;

    if (!response.ok || !json?.data) {
        throw new Error(json?.error ?? "Could not process all campaigns");
    }

    return json.data;
}

export function useCampaignAudiencePreview(selectedIds: string[]) {
    return useQuery({
        queryKey: ["campaign-audience-preview", selectedIds],
        queryFn: () => fetchCampaignAudiencePreview(selectedIds),
        enabled: selectedIds.length > 0,
        staleTime: 10_000,
    });
}

export function useOwnerCampaigns() {
    return useQuery({
        queryKey: ["owner-campaigns"],
        queryFn: fetchOwnerCampaigns,
        staleTime: 10_000,
    });
}

export function useOwnerCampaignDetail(campaignId: string) {
    return useQuery({
        queryKey: ["owner-campaigns", campaignId],
        queryFn: () => fetchOwnerCampaignDetail(campaignId),
        enabled: Boolean(campaignId),
        staleTime: 10_000,
        refetchInterval: (query) =>
            query.state.data?.status === "sending" ? 4_000 : false,
    });
}

export function useCreateOwnerCampaign() {
    return useMutation({
        mutationFn: createOwnerCampaign,
    });
}

export function useSendOwnerCampaign() {
    return useMutation({
        mutationFn: sendOwnerCampaign,
    });
}

export function useProcessOwnerCampaignQueue() {
    return useMutation({
        mutationFn: processOwnerCampaignQueue,
    });
}

export function useProcessAllOwnerCampaignsQueue() {
    return useMutation({
        mutationFn: processAllOwnerCampaignsQueue,
    });
}
