import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { decryptSecret } from "@/lib/security/secrets";

type PassKitCreatePayload = {
    tenantId: string;
    customerId: string;
    customerName: string;
    phone: string;
    pointsBalance: number;
    qrCodeUrl: string | null;
    memberSinceIso: string;
    tenantName?: string;
};

type PassKitUpdatePayload = {
    tenantId: string;
    walletPassId: string;
    pointsBalance: number;
};

type PassKitCreateResponse = {
    walletPassId: string;
    downloadUrl: string | null;
};

type PassKitUpdateResponse = {
    updated: true;
};

function getPassKitEnvConfig() {
    const baseUrl = process.env.PASSKIT_BASE_URL?.trim();
    const apiKey = process.env.PASSKIT_API_KEY?.trim();
    const templateId = process.env.PASSKIT_TEMPLATE_ID?.trim();

    if (!baseUrl || !apiKey || !templateId) {
        return null;
    }

    return {
        baseUrl: baseUrl.replace(/\/$/, ""),
        apiKey,
        templateId,
    };
}

async function getTenantPassKitConfig(tenantId: string) {
    const row = await db.query.apiKeys.findFirst({
        where: and(
            eq(apiKeys.tenantId, tenantId),
            eq(apiKeys.service, "passkit"),
            eq(apiKeys.isActive, "true")
        ),
        columns: {
            encryptedKey: true,
        },
    });

    if (row?.encryptedKey) {
        try {
            const parsed = JSON.parse(decryptSecret(row.encryptedKey)) as {
                baseUrl?: string;
                apiKey?: string;
                templateId?: string;
            };

            if (parsed.baseUrl && parsed.apiKey && parsed.templateId) {
                return {
                    baseUrl: parsed.baseUrl.replace(/\/$/, ""),
                    apiKey: parsed.apiKey,
                    templateId: parsed.templateId,
                };
            }
        } catch {
            return null;
        }
    }

    return getPassKitEnvConfig();
}

async function callPassKit<T>(params: {
    tenantId: string;
    endpoint: string;
    body: Record<string, unknown>;
}) {
    const config = await getTenantPassKitConfig(params.tenantId);
    if (!config) {
        return null;
    }

    const response = await fetch(`${config.baseUrl}${params.endpoint}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
            "X-Passkit-Template": config.templateId,
        },
        body: JSON.stringify(params.body),
    });

    const payload = (await response.json().catch(() => null)) as T | null;
    if (!response.ok || !payload) {
        throw new Error("PassKit API request failed");
    }

    return payload;
}

export async function createWalletPass(payload: PassKitCreatePayload) {
    const response = await callPassKit<{
        passId?: string;
        id?: string;
        downloadUrl?: string;
        url?: string;
    }>({
        tenantId: payload.tenantId,
        endpoint: "/passes/create",
        body: {
            customerId: payload.customerId,
            name: payload.customerName,
            phone: payload.phone,
            points: payload.pointsBalance,
            qrCode: payload.qrCodeUrl,
            memberSince: payload.memberSinceIso,
            businessName: payload.tenantName,
        },
    });

    if (!response) {
        return null;
    }

    const walletPassId = response.passId ?? response.id;
    if (!walletPassId) {
        throw new Error("PassKit response missing pass id");
    }

    return {
        walletPassId,
        downloadUrl: response.downloadUrl ?? response.url ?? null,
    } satisfies PassKitCreateResponse;
}

export async function updateWalletPassPoints(payload: PassKitUpdatePayload) {
    const response = await callPassKit<{ success?: boolean }>({
        tenantId: payload.tenantId,
        endpoint: "/passes/update",
        body: {
            passId: payload.walletPassId,
            points: payload.pointsBalance,
        },
    });

    if (!response) {
        return null;
    }

    return {
        updated: true,
    } satisfies PassKitUpdateResponse;
}
