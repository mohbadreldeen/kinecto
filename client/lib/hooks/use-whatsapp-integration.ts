"use client";

import { useMutation, useQuery } from "@tanstack/react-query";

export type WhatsAppIntegrationSettings = {
    configured: boolean;
    label: string | null;
    baseUrl: string;
    senderId: string;
    apiKeyMasked: string;
    updatedAt?: string;
};

type SaveWhatsAppIntegrationPayload = {
    label?: string;
    baseUrl: string;
    senderId: string;
    apiKey: string;
};

async function fetchWhatsAppIntegrationSettings() {
    const response = await fetch("/api/settings/integrations/whatsapp", {
        method: "GET",
        credentials: "include",
    });

    const payload = (await response.json().catch(() => null)) as {
        data?: WhatsAppIntegrationSettings;
        error?: string;
    } | null;

    if (!response.ok || !payload?.data) {
        throw new Error(payload?.error ?? "Could not load WhatsApp settings");
    }

    return payload.data;
}

async function saveWhatsAppIntegrationSettings(
    payload: SaveWhatsAppIntegrationPayload
) {
    const response = await fetch("/api/settings/integrations/whatsapp", {
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
        throw new Error(result?.error ?? "Could not save WhatsApp settings");
    }

    return result.data;
}

export function useWhatsAppIntegrationSettings() {
    return useQuery({
        queryKey: ["whatsapp-integration-settings"],
        queryFn: fetchWhatsAppIntegrationSettings,
        staleTime: 10_000,
    });
}

export function useSaveWhatsAppIntegrationSettings() {
    return useMutation({
        mutationFn: saveWhatsAppIntegrationSettings,
    });
}
