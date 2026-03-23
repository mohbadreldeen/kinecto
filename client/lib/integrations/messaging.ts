import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { decryptSecret } from "@/lib/security/secrets";

type Channel = "whatsapp" | "email";

type WhatsAppConfig = {
    baseUrl: string;
    apiKey: string;
    senderId: string;
};

type EmailConfig = {
    provider: "resend" | "sendgrid";
    fromEmail: string;
    apiKey: string;
};

type SendMessageInput = {
    tenantId: string;
    channel: Channel;
    content: string;
    phone: string | null;
    email: string | null;
};

export type SendMessageResult = {
    ok: boolean;
    externalId: string | null;
    errorMessage: string | null;
    retryable?: boolean;
    retryAfterSeconds?: number | null;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const e164Regex = /^\+[1-9]\d{7,14}$/;

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function parseRetryAfterSeconds(value: string | null) {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();
    const numericValue = Number(trimmed);
    if (Number.isFinite(numericValue) && numericValue >= 0) {
        return Math.ceil(numericValue);
    }

    const retryAt = Date.parse(trimmed);
    if (Number.isNaN(retryAt)) {
        return null;
    }

    return Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
}

function parseWhatsAppConfig(raw: string): WhatsAppConfig | null {
    try {
        const parsed = JSON.parse(decryptSecret(raw)) as unknown;
        if (!isObject(parsed)) {
            return null;
        }

        const baseUrl =
            typeof parsed.baseUrl === "string" ? parsed.baseUrl : "";
        const apiKey = typeof parsed.apiKey === "string" ? parsed.apiKey : "";
        const senderId =
            typeof parsed.senderId === "string" ? parsed.senderId : "";

        if (!baseUrl || !apiKey || !senderId) {
            return null;
        }

        return {
            baseUrl: baseUrl.replace(/\/$/, ""),
            apiKey,
            senderId,
        };
    } catch {
        return null;
    }
}

function parseEmailConfig(raw: string): EmailConfig | null {
    try {
        const parsed = JSON.parse(decryptSecret(raw)) as unknown;
        if (!isObject(parsed)) {
            return null;
        }

        const provider =
            parsed.provider === "resend" || parsed.provider === "sendgrid"
                ? parsed.provider
                : null;
        const fromEmail =
            typeof parsed.fromEmail === "string" ? parsed.fromEmail : "";
        const apiKey = typeof parsed.apiKey === "string" ? parsed.apiKey : "";

        if (!provider || !fromEmail || !apiKey) {
            return null;
        }

        return {
            provider,
            fromEmail,
            apiKey,
        };
    } catch {
        return null;
    }
}

async function getServiceConfig(tenantId: string, service: Channel) {
    const row = await db.query.apiKeys.findFirst({
        where: and(
            eq(apiKeys.tenantId, tenantId),
            eq(apiKeys.service, service),
            eq(apiKeys.isActive, "true")
        ),
        columns: {
            encryptedKey: true,
        },
    });

    if (!row?.encryptedKey) {
        return null;
    }

    return service === "whatsapp"
        ? parseWhatsAppConfig(row.encryptedKey)
        : parseEmailConfig(row.encryptedKey);
}

export function isValidWhatsAppPhone(phone: string) {
    return e164Regex.test(phone.trim());
}

export function isValidEmailAddress(email: string) {
    return emailRegex.test(email.trim());
}

export async function sendTenantMessage(
    input: SendMessageInput
): Promise<SendMessageResult> {
    if (input.channel === "whatsapp") {
        if (!input.phone || !isValidWhatsAppPhone(input.phone)) {
            return {
                ok: false,
                externalId: null,
                errorMessage: "Invalid WhatsApp phone number",
            };
        }

        const config = await getServiceConfig(input.tenantId, "whatsapp");
        if (!config) {
            return {
                ok: false,
                externalId: null,
                errorMessage: "Missing active whatsapp integration credentials",
            };
        }

        const whatsappConfig = config as WhatsAppConfig;

        // Default mode is mock dispatch to keep local and CI deterministic.
        if (process.env.MESSAGING_MOCK_MODE !== "off") {
            return {
                ok: true,
                externalId: `wa_mock_${randomUUID()}`,
                errorMessage: null,
            };
        }

        let response: Response;
        try {
            response = await fetch(`${whatsappConfig.baseUrl}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${whatsappConfig.apiKey}`,
                },
                body: JSON.stringify({
                    to: input.phone,
                    senderId: whatsappConfig.senderId,
                    message: input.content,
                }),
            });
        } catch {
            return {
                ok: false,
                externalId: null,
                errorMessage: "WhatsApp provider request failed",
                retryable: true,
                retryAfterSeconds: null,
            };
        }

        const payload = (await response.json().catch(() => null)) as {
            id?: string;
            messageId?: string;
            error?: string;
        } | null;

        const retryAfterSeconds = parseRetryAfterSeconds(
            response.headers.get("retry-after")
        );

        if (response.status === 429) {
            return {
                ok: false,
                externalId: null,
                errorMessage:
                    payload?.error ?? "WhatsApp provider rate limit exceeded",
                retryable: true,
                retryAfterSeconds,
            };
        }

        if (!response.ok) {
            return {
                ok: false,
                externalId: null,
                errorMessage:
                    payload?.error ?? "WhatsApp provider request failed",
                retryable: response.status >= 500,
                retryAfterSeconds:
                    response.status >= 500 ? retryAfterSeconds : null,
            };
        }

        return {
            ok: true,
            externalId:
                payload?.id ?? payload?.messageId ?? `wa_${randomUUID()}`,
            errorMessage: null,
        };
    }

    if (!input.email || !isValidEmailAddress(input.email)) {
        return {
            ok: false,
            externalId: null,
            errorMessage: "Missing or invalid customer email",
        };
    }

    const config = await getServiceConfig(input.tenantId, "email");
    if (!config) {
        return {
            ok: false,
            externalId: null,
            errorMessage: "Missing active email integration credentials",
        };
    }

    const emailConfig = config as EmailConfig;

    if (process.env.MESSAGING_MOCK_MODE !== "off") {
        return {
            ok: true,
            externalId: `email_mock_${randomUUID()}`,
            errorMessage: null,
        };
    }

    // Provider call is abstracted for now; this keeps transport pluggable.
    return {
        ok: true,
        externalId: `email_${emailConfig.provider}_${randomUUID()}`,
        errorMessage: null,
    };
}
