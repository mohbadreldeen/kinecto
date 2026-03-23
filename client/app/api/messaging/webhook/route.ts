import { eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { campaigns, customers, messages } from "@/lib/db/schema";

const payloadSchema = z
    .object({
        events: z
            .array(
                z.object({
                    externalId: z.string().min(1),
                    status: z.enum(["sent", "delivered", "read", "failed"]),
                    errorMessage: z.string().trim().max(500).optional(),
                    occurredAt: z.string().datetime().optional(),
                })
            )
            .max(1000)
            .default([]),
        optOutEvents: z
            .array(
                z.object({
                    channel: z.enum(["whatsapp", "email"]),
                    from: z.string().trim().min(3),
                    text: z.string().trim().min(1),
                    occurredAt: z.string().datetime().optional(),
                })
            )
            .max(1000)
            .default([]),
    })
    .superRefine((payload, context) => {
        if (payload.events.length === 0 && payload.optOutEvents.length === 0) {
            context.addIssue({
                code: z.ZodIssueCode.custom,
                message: "At least one event is required",
                path: ["events"],
            });
        }
    });

function normalizePhone(value: string) {
    return value
        .replace(/^whatsapp:/i, "")
        .replace(/[\s()-]/g, "")
        .trim();
}

const stopPhrases = new Set([
    "stop",
    "stop all",
    "unsubscribe",
    "cancel",
    "end",
    "quit",
    "arret",
    "arreter",
    "desabonner",
    "desinscription",
    "baja",
]);

const politePrefixes = new Set(["please", "pls"]);

function normalizeOptOutText(value: string) {
    return value
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/gi, " ")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

function isStopMessage(text: string) {
    const normalized = normalizeOptOutText(text);
    if (!normalized) {
        return false;
    }

    if (stopPhrases.has(normalized)) {
        return true;
    }

    const tokens = normalized.split(" ");
    if (tokens.length > 1 && politePrefixes.has(tokens[0])) {
        return stopPhrases.has(tokens.slice(1).join(" "));
    }

    return false;
}

function resolveCampaignStatus(input: {
    total: number;
    queued: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
}) {
    if (input.total === 0) {
        return "draft" as const;
    }

    if (input.queued > 0) {
        return "sending" as const;
    }

    if (input.failed === input.total) {
        return "failed" as const;
    }

    if (input.sent + input.delivered + input.read > 0) {
        return "sent" as const;
    }

    return "sending" as const;
}

function parseMetaStatus(value: string) {
    if (value === "sent") {
        return "sent" as const;
    }

    if (value === "delivered") {
        return "delivered" as const;
    }

    if (value === "read") {
        return "read" as const;
    }

    if (value === "failed") {
        return "failed" as const;
    }

    return null;
}

function parseTwilioStatus(value: string) {
    const normalized = value.trim().toLowerCase();

    if (
        normalized === "queued" ||
        normalized === "accepted" ||
        normalized === "sending" ||
        normalized === "sent"
    ) {
        return "sent" as const;
    }

    if (normalized === "delivered") {
        return "delivered" as const;
    }

    if (normalized === "read") {
        return "read" as const;
    }

    if (
        normalized === "failed" ||
        normalized === "undelivered" ||
        normalized === "canceled"
    ) {
        return "failed" as const;
    }

    return null;
}

function parseInfobipStatus(value: string) {
    const normalized = value
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

    if (
        normalized === "pending" ||
        normalized === "accepted" ||
        normalized === "submitted" ||
        normalized === "sent"
    ) {
        return "sent" as const;
    }

    if (normalized === "delivered" || normalized === "delivered_to_handset") {
        return "delivered" as const;
    }

    if (normalized === "seen" || normalized === "read") {
        return "read" as const;
    }

    if (
        normalized === "failed" ||
        normalized === "rejected" ||
        normalized === "undeliverable" ||
        normalized === "undelivered" ||
        normalized === "expired"
    ) {
        return "failed" as const;
    }

    return null;
}

function normalizeProviderPayload(body: unknown) {
    if (!body || typeof body !== "object") {
        return body;
    }

    const input = body as Record<string, unknown>;
    const hasInternalShape =
        Array.isArray(input.events) || Array.isArray(input.optOutEvents);
    if (hasInternalShape) {
        return body;
    }

    const normalizedEvents: Array<{
        externalId: string;
        status: "sent" | "delivered" | "read" | "failed";
        errorMessage?: string;
        occurredAt?: string;
    }> = [];
    const normalizedOptOutEvents: Array<{
        channel: "whatsapp" | "email";
        from: string;
        text: string;
        occurredAt?: string;
    }> = [];

    // Meta WhatsApp Cloud API webhook payload.
    const entries = Array.isArray(input.entry) ? input.entry : [];
    for (const entry of entries) {
        if (!entry || typeof entry !== "object") {
            continue;
        }

        const changes = Array.isArray(
            (entry as Record<string, unknown>).changes
        )
            ? ((entry as Record<string, unknown>).changes as unknown[])
            : [];

        for (const change of changes) {
            if (!change || typeof change !== "object") {
                continue;
            }

            const value = (change as Record<string, unknown>).value;
            if (!value || typeof value !== "object") {
                continue;
            }

            const valueRecord = value as Record<string, unknown>;

            const statuses = Array.isArray(valueRecord.statuses)
                ? (valueRecord.statuses as unknown[])
                : [];
            for (const rawStatus of statuses) {
                if (!rawStatus || typeof rawStatus !== "object") {
                    continue;
                }

                const statusRecord = rawStatus as Record<string, unknown>;
                const externalId =
                    typeof statusRecord.id === "string"
                        ? statusRecord.id.trim()
                        : "";
                const parsedStatus =
                    typeof statusRecord.status === "string"
                        ? parseMetaStatus(statusRecord.status)
                        : null;
                if (!externalId || !parsedStatus) {
                    continue;
                }

                const occurredAt =
                    typeof statusRecord.timestamp === "string"
                        ? new Date(
                              Number.isNaN(Number(statusRecord.timestamp))
                                  ? statusRecord.timestamp
                                  : Number(statusRecord.timestamp) * 1000
                          ).toISOString()
                        : undefined;

                const errors = Array.isArray(statusRecord.errors)
                    ? statusRecord.errors
                    : [];
                const firstError =
                    errors.length > 0 &&
                    errors[0] &&
                    typeof errors[0] === "object"
                        ? (errors[0] as Record<string, unknown>)
                        : null;
                const errorMessage =
                    parsedStatus === "failed"
                        ? typeof firstError?.title === "string"
                            ? firstError.title
                            : undefined
                        : undefined;

                normalizedEvents.push({
                    externalId,
                    status: parsedStatus,
                    occurredAt,
                    ...(errorMessage ? { errorMessage } : {}),
                });
            }

            const inboundMessages = Array.isArray(valueRecord.messages)
                ? (valueRecord.messages as unknown[])
                : [];
            for (const inboundMessage of inboundMessages) {
                if (!inboundMessage || typeof inboundMessage !== "object") {
                    continue;
                }

                const messageRecord = inboundMessage as Record<string, unknown>;
                const from =
                    typeof messageRecord.from === "string"
                        ? messageRecord.from.trim()
                        : "";
                const messageType =
                    typeof messageRecord.type === "string"
                        ? messageRecord.type
                        : "";

                let text = "";
                if (messageType === "text") {
                    const textPayload = messageRecord.text;
                    if (textPayload && typeof textPayload === "object") {
                        const bodyText = (
                            textPayload as Record<string, unknown>
                        ).body;
                        if (typeof bodyText === "string") {
                            text = bodyText.trim();
                        }
                    }
                }

                if (!from || !text) {
                    continue;
                }

                const occurredAt =
                    typeof messageRecord.timestamp === "string"
                        ? new Date(
                              Number.isNaN(Number(messageRecord.timestamp))
                                  ? messageRecord.timestamp
                                  : Number(messageRecord.timestamp) * 1000
                          ).toISOString()
                        : undefined;

                normalizedOptOutEvents.push({
                    channel: "whatsapp",
                    from,
                    text,
                    occurredAt,
                });
            }
        }
    }

    // Twilio callback payload (JSON or form-urlencoded parsed into object).
    const twilioMessageSid =
        typeof input.MessageSid === "string" ? input.MessageSid.trim() : "";
    const twilioMessageStatus =
        typeof input.MessageStatus === "string"
            ? input.MessageStatus.trim()
            : "";
    if (twilioMessageSid && twilioMessageStatus) {
        const status = parseTwilioStatus(twilioMessageStatus);
        if (status) {
            const errorMessage =
                typeof input.ErrorMessage === "string"
                    ? input.ErrorMessage.trim()
                    : "";
            const occurredAt = new Date().toISOString();

            normalizedEvents.push({
                externalId: twilioMessageSid,
                status,
                occurredAt,
                ...(status === "failed" && errorMessage
                    ? { errorMessage }
                    : {}),
            });
        }
    }

    const twilioFrom = typeof input.From === "string" ? input.From.trim() : "";
    const twilioBody = typeof input.Body === "string" ? input.Body.trim() : "";
    const twilioSmsStatus =
        typeof input.SmsStatus === "string"
            ? input.SmsStatus.trim().toLowerCase()
            : "";
    const twilioInbound =
        twilioSmsStatus === "received" ||
        twilioSmsStatus === "inbound" ||
        twilioMessageStatus.toLowerCase() === "received";

    if (twilioInbound && twilioFrom && twilioBody) {
        normalizedOptOutEvents.push({
            channel: "whatsapp",
            from: twilioFrom,
            text: twilioBody,
            occurredAt: new Date().toISOString(),
        });
    }

    // Infobip WhatsApp status and inbound message payloads.
    const infobipResults = Array.isArray(input.results)
        ? (input.results as unknown[])
        : [];
    for (const rawResult of infobipResults) {
        if (!rawResult || typeof rawResult !== "object") {
            continue;
        }

        const result = rawResult as Record<string, unknown>;
        const messageId =
            typeof result.messageId === "string" ? result.messageId.trim() : "";
        const statusPayload =
            result.status && typeof result.status === "object"
                ? (result.status as Record<string, unknown>)
                : null;
        const statusCandidates = [
            typeof statusPayload?.name === "string" ? statusPayload.name : "",
            typeof statusPayload?.groupName === "string"
                ? statusPayload.groupName
                : "",
            typeof statusPayload?.description === "string"
                ? statusPayload.description
                : "",
        ].filter((value) => value.length > 0);

        let infobipStatus: "sent" | "delivered" | "read" | "failed" | null =
            null;
        for (const statusCandidate of statusCandidates) {
            infobipStatus = parseInfobipStatus(statusCandidate);
            if (infobipStatus) {
                break;
            }
        }

        if (messageId && infobipStatus) {
            const errorPayload =
                result.error && typeof result.error === "object"
                    ? (result.error as Record<string, unknown>)
                    : null;
            const errorMessage =
                infobipStatus === "failed"
                    ? typeof errorPayload?.description === "string"
                        ? errorPayload.description.trim()
                        : typeof statusPayload?.description === "string"
                          ? statusPayload.description.trim()
                          : ""
                    : "";
            const occurredAt =
                typeof result.doneAt === "string"
                    ? result.doneAt
                    : typeof result.sentAt === "string"
                      ? result.sentAt
                      : new Date().toISOString();

            normalizedEvents.push({
                externalId: messageId,
                status: infobipStatus,
                occurredAt,
                ...(errorMessage ? { errorMessage } : {}),
            });
            continue;
        }

        const from = typeof result.from === "string" ? result.from.trim() : "";
        const occurredAt =
            typeof result.receivedAt === "string"
                ? result.receivedAt
                : new Date().toISOString();
        const messagePayload =
            result.message && typeof result.message === "object"
                ? (result.message as Record<string, unknown>)
                : null;
        const messageType =
            typeof messagePayload?.type === "string"
                ? messagePayload.type.trim().toLowerCase()
                : "";
        const text =
            typeof messagePayload?.text === "string"
                ? messagePayload.text.trim()
                : "";

        if (from && text && (!messageType || messageType === "text")) {
            normalizedOptOutEvents.push({
                channel: "whatsapp",
                from,
                text,
                occurredAt,
            });
        }
    }

    if (normalizedEvents.length === 0 && normalizedOptOutEvents.length === 0) {
        return body;
    }

    return {
        events: normalizedEvents,
        optOutEvents: normalizedOptOutEvents,
    };
}

export async function POST(request: NextRequest) {
    const webhookSecret = process.env.MESSAGING_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
        return NextResponse.json(
            { error: "Webhook secret is not configured" },
            { status: 503 }
        );
    }

    const providedSecret = request.headers
        .get("x-kinecto-webhook-secret")
        ?.trim();

    if (!providedSecret || providedSecret !== webhookSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType =
        request.headers.get("content-type")?.toLowerCase() ?? "";
    const parseFormBody = async () => {
        const rawBody = await request
            .clone()
            .text()
            .catch(() => "");
        if (!rawBody) {
            return null;
        }

        const parsedForm = new URLSearchParams(rawBody);
        const formObject: Record<string, string> = {};
        for (const [key, value] of parsedForm.entries()) {
            formObject[key] = value;
        }

        return Object.keys(formObject).length > 0 ? formObject : null;
    };

    let body: unknown = null;
    if (contentType.includes("application/json")) {
        body = await request
            .clone()
            .json()
            .catch(() => null);
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
        body = await parseFormBody();
    } else {
        body = await request
            .clone()
            .json()
            .catch(() => null);
        if (!body) {
            body = await parseFormBody();
        }
    }

    const normalizedBody = normalizeProviderPayload(body);
    const parsedBody = payloadSchema.safeParse(normalizedBody);
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: "Invalid payload",
                details: parsedBody.error.flatten(),
            },
            { status: 400 }
        );
    }

    const statusEvents = parsedBody.data.events;
    const optOutEvents = parsedBody.data.optOutEvents;

    let touchedMessages: Array<{
        id: string;
        campaignId: string;
        externalId: string | null;
    }> = [];
    if (statusEvents.length > 0) {
        const externalIds = statusEvents.map((event) => event.externalId);
        touchedMessages = await db
            .select({
                id: messages.id,
                campaignId: messages.campaignId,
                externalId: messages.externalId,
            })
            .from(messages)
            .where(inArray(messages.externalId, externalIds));
    }

    const eventByExternalId = new Map(
        statusEvents.map((event) => [event.externalId, event])
    );
    const touchedCampaigns = new Set<string>();
    let processed = 0;

    for (const messageRow of touchedMessages) {
        const event = messageRow.externalId
            ? eventByExternalId.get(messageRow.externalId)
            : undefined;
        if (!event) {
            continue;
        }

        const occurredAt = event.occurredAt
            ? new Date(event.occurredAt)
            : new Date();

        await db
            .update(messages)
            .set({
                status: event.status,
                errorMessage:
                    event.status === "failed"
                        ? (event.errorMessage ?? "Provider delivery failure")
                        : null,
                sentAt: event.status === "sent" ? occurredAt : undefined,
                deliveredAt:
                    event.status === "delivered" || event.status === "read"
                        ? occurredAt
                        : undefined,
            })
            .where(eq(messages.id, messageRow.id));

        touchedCampaigns.add(messageRow.campaignId);
        processed += 1;
    }

    for (const campaignId of touchedCampaigns) {
        const campaignMessages = await db
            .select({ status: messages.status })
            .from(messages)
            .where(eq(messages.campaignId, campaignId));

        const totals = {
            total: campaignMessages.length,
            queued: campaignMessages.filter((item) => item.status === "queued")
                .length,
            sent: campaignMessages.filter((item) => item.status === "sent")
                .length,
            delivered: campaignMessages.filter(
                (item) => item.status === "delivered"
            ).length,
            read: campaignMessages.filter((item) => item.status === "read")
                .length,
            failed: campaignMessages.filter((item) => item.status === "failed")
                .length,
        };

        await db
            .update(campaigns)
            .set({
                status: resolveCampaignStatus(totals),
                updatedAt: new Date(),
                sentAt: totals.queued === 0 ? new Date() : null,
                stats: {
                    queued: totals.queued,
                    sent: totals.sent + totals.delivered + totals.read,
                    delivered: totals.delivered + totals.read,
                    failed: totals.failed,
                },
            })
            .where(eq(campaigns.id, campaignId));
    }

    const stopPhones = [
        ...new Set(
            optOutEvents
                .filter((event) => event.channel === "whatsapp")
                .filter((event) => isStopMessage(event.text))
                .map((event) => normalizePhone(event.from))
        ),
    ];

    let unsubscribed = 0;
    if (stopPhones.length > 0) {
        const customerRows = await db
            .select({
                id: customers.id,
                phone: customers.phone,
            })
            .from(customers)
            .where(inArray(customers.phone, stopPhones));

        const customerIds = customerRows.map((row) => row.id);
        if (customerIds.length > 0) {
            await db
                .update(customers)
                .set({
                    unsubscribed: true,
                    updatedAt: new Date(),
                })
                .where(inArray(customers.id, customerIds));
            unsubscribed = customerIds.length;
        }
    }

    return NextResponse.json({
        data: {
            processed,
            matched: touchedMessages.length,
            campaignsUpdated: touchedCampaigns.size,
            unsubscribed,
        },
    });
}
