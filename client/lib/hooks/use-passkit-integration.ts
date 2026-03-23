"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

export type PassKitIntegrationSettings = {
    configured: boolean;
    label: string | null;
    baseUrl: string;
    templateId: string;
    apiKeyMasked: string;
    updatedAt?: string;
};

type SavePassKitIntegrationPayload = {
    label?: string;
    baseUrl: string;
    apiKey: string;
    templateId: string;
};

async function fetchPassKitIntegrationSettings() {
    const response = await fetch("/api/settings/integrations/passkit", {
        method: "GET",
        credentials: "include",
    });

    const payload = (await response.json().catch(() => null)) as {
        data?: PassKitIntegrationSettings;
        error?: string;
    } | null;

    if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Could not load PassKit settings");
    }

    return payload.data;
}

async function savePassKitIntegrationSettings(
    payload: SavePassKitIntegrationPayload
) {
    const response = await fetch("/api/settings/integrations/passkit", {
        method: "PUT",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    const result = (await response.json().catch(() => null)) as {
        data?: { saved: boolean };
        error?: string;
    } | null;

    if (!response.ok || !result?.data) {
        throw new Error(result?.error ?? "Could not save PassKit settings");
    }

    return result.data;
}

export function usePassKitIntegrationSettings() {
    return useQuery({
        queryKey: ["passkit-integration-settings"],
        queryFn: fetchPassKitIntegrationSettings,
        staleTime: 10_000,
    });
}

export function useSavePassKitIntegrationSettings() {
    return useMutation({
        mutationFn: savePassKitIntegrationSettings,
    });
}
