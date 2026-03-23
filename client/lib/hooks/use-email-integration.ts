"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

export type EmailIntegrationSettings = {
    configured: boolean;
    label: string | null;
    provider: "resend" | "sendgrid";
    fromEmail: string;
    apiKeyMasked: string;
    updatedAt?: string;
};

type SaveEmailIntegrationPayload = {
    label?: string;
    provider: "resend" | "sendgrid";
    fromEmail: string;
    apiKey: string;
};

async function fetchEmailIntegrationSettings() {
    const response = await fetch("/api/settings/integrations/email", {
        method: "GET",
        credentials: "include",
    });

    const payload = (await response.json().catch(() => null)) as {
        data?: EmailIntegrationSettings;
        error?: string;
    } | null;

    if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Could not load Email settings");
    }

    return payload.data;
}

async function saveEmailIntegrationSettings(
    payload: SaveEmailIntegrationPayload
) {
    const response = await fetch("/api/settings/integrations/email", {
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
        throw new Error(result?.error ?? "Could not save Email settings");
    }

    return result.data;
}

export function useEmailIntegrationSettings() {
    return useQuery({
        queryKey: ["email-integration-settings"],
        queryFn: fetchEmailIntegrationSettings,
        staleTime: 10_000,
    });
}

export function useSaveEmailIntegrationSettings() {
    return useMutation({
        mutationFn: saveEmailIntegrationSettings,
    });
}
