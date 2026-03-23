import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { campaigns, customers, messages } from "@/lib/db/schema";
import { sendTenantMessage } from "@/lib/integrations/messaging";

const DEFAULT_RETRY_AFTER_SECONDS = 60;
const MAX_RETRY_AFTER_SECONDS = 3_600;
const MAX_RETRY_ATTEMPTS = 5;

export type ProcessQueueResult = {
    tenantId: string;
    processed: number;
    sent: number;
    failed: number;
    deferred: number;
    rateLimited: boolean;
    retryAfterSeconds: number | null;
    campaignsUpdated: number;
};

// Provider-specific retry backoff windows (in seconds)
const PROVIDER_RETRY_SCHEDULES: Record<
    "whatsapp" | "email" | "sms",
    { baseDelay: number; maxDelay: number; multiplier: number }
> = {
    whatsapp: { baseDelay: 2, maxDelay: 900, multiplier: 1.5 }, // 2s → max 15min
    sms: { baseDelay: 5, maxDelay: 1_800, multiplier: 2 }, // 5s → max 30min (Infobip)
    email: { baseDelay: 30, maxDelay: 300, multiplier: 1.5 }, // 30s → max 5min
};

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

function resolveRetryDelaySeconds(
    attemptCount: number,
    retryAfterSeconds: number | null,
    channel: string = "whatsapp"
) {
    // If provider explicitly specifies retry-after (e.g., 429 response), respect it
    if (
        typeof retryAfterSeconds === "number" &&
        Number.isFinite(retryAfterSeconds) &&
        retryAfterSeconds >= 0
    ) {
        return Math.min(MAX_RETRY_AFTER_SECONDS, Math.ceil(retryAfterSeconds));
    }

    // Normalize channel to known schedule
    const normalizedChannel = (
        channel.toLowerCase() === "email"
            ? "email"
            : channel.toLowerCase() === "sms"
              ? "sms"
              : "whatsapp"
    ) as keyof typeof PROVIDER_RETRY_SCHEDULES;

    const schedule = PROVIDER_RETRY_SCHEDULES[normalizedChannel];

    // Calculate backoff: baseDelay * (multiplier ^ min(attemptCount, 5))
    // Cap at provider's maxDelay
    const exponentialDelay = Math.min(
        schedule.maxDelay,
        Math.ceil(
            schedule.baseDelay *
                Math.pow(schedule.multiplier, Math.min(attemptCount, 5))
        )
    );

    return exponentialDelay;
}

export async function processTenantQueue(
    tenantId: string,
    limit = 100,
    campaignId?: string
): Promise<ProcessQueueResult> {
    const now = new Date();
    const queuedRows = await db
        .select({
            id: messages.id,
            tenantId: messages.tenantId,
            campaignId: messages.campaignId,
            customerId: messages.customerId,
            channel: messages.channel,
            content: messages.content,
            attemptCount: messages.attemptCount,
            customerPhone: customers.phone,
            customerEmail: customers.email,
        })
        .from(messages)
        .innerJoin(customers, eq(messages.customerId, customers.id))
        .where(
            campaignId
                ? and(
                      eq(messages.tenantId, tenantId),
                      eq(messages.campaignId, campaignId),
                      eq(messages.status, "queued"),
                      or(
                          isNull(messages.nextAttemptAt),
                          lte(messages.nextAttemptAt, now)
                      )
                  )
                : and(
                      eq(messages.tenantId, tenantId),
                      eq(messages.status, "queued"),
                      or(
                          isNull(messages.nextAttemptAt),
                          lte(messages.nextAttemptAt, now)
                      )
                  )
        )
        .orderBy(
            sql`${messages.nextAttemptAt} asc nulls first`,
            asc(messages.createdAt)
        )
        .limit(limit);

    if (queuedRows.length === 0) {
        return {
            tenantId,
            processed: 0,
            sent: 0,
            failed: 0,
            deferred: 0,
            rateLimited: false,
            retryAfterSeconds: null,
            campaignsUpdated: 0,
        };
    }

    let processed = 0;
    let sent = 0;
    let failed = 0;
    let deferred = 0;
    let rateLimited = false;
    let retryAfterSeconds: number | null = null;
    const touchedCampaigns = new Set<string>();

    for (const [index, row] of queuedRows.entries()) {
        const result = await sendTenantMessage({
            tenantId: row.tenantId,
            channel: row.channel as "whatsapp" | "email",
            content: row.content,
            phone: row.customerPhone,
            email: row.customerEmail,
        });
        processed += 1;

        touchedCampaigns.add(row.campaignId);

        if (result.ok) {
            sent += 1;
            await db
                .update(messages)
                .set({
                    status: "sent",
                    attemptCount: row.attemptCount + 1,
                    nextAttemptAt: null,
                    externalId: result.externalId,
                    errorMessage: null,
                    sentAt: new Date(),
                })
                .where(eq(messages.id, row.id));
        } else if (result.retryable) {
            const nextAttemptCount = row.attemptCount + 1;

            if (nextAttemptCount >= MAX_RETRY_ATTEMPTS) {
                failed += 1;
                await db
                    .update(messages)
                    .set({
                        status: "failed",
                        attemptCount: nextAttemptCount,
                        nextAttemptAt: null,
                        errorMessage:
                            result.errorMessage ??
                            "Provider request failed after retries",
                    })
                    .where(eq(messages.id, row.id));
                continue;
            }

            const scheduledRetryAfterSeconds = resolveRetryDelaySeconds(
                row.attemptCount,
                result.retryAfterSeconds ?? null,
                row.channel
            );

            await db
                .update(messages)
                .set({
                    attemptCount: nextAttemptCount,
                    nextAttemptAt: new Date(
                        now.getTime() + scheduledRetryAfterSeconds * 1_000
                    ),
                    errorMessage:
                        result.errorMessage ??
                        "Provider temporarily unavailable",
                })
                .where(eq(messages.id, row.id));

            deferred = queuedRows.length - index;
            rateLimited = true;
            retryAfterSeconds = scheduledRetryAfterSeconds;
            break;
        } else {
            failed += 1;
            await db
                .update(messages)
                .set({
                    status: "failed",
                    attemptCount: row.attemptCount + 1,
                    nextAttemptAt: null,
                    errorMessage:
                        result.errorMessage ?? "Provider request failed",
                })
                .where(eq(messages.id, row.id));
        }
    }

    for (const campaignId of touchedCampaigns) {
        const campaignMessages = await db
            .select({ status: messages.status })
            .from(messages)
            .where(eq(messages.campaignId, campaignId));

        const totals = {
            total: campaignMessages.length,
            queued: campaignMessages.filter((m) => m.status === "queued")
                .length,
            sent: campaignMessages.filter((m) => m.status === "sent").length,
            delivered: campaignMessages.filter((m) => m.status === "delivered")
                .length,
            read: campaignMessages.filter((m) => m.status === "read").length,
            failed: campaignMessages.filter((m) => m.status === "failed")
                .length,
        };

        const status = resolveCampaignStatus(totals);

        await db
            .update(campaigns)
            .set({
                status,
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

    return {
        tenantId,
        processed,
        sent,
        failed,
        deferred,
        rateLimited,
        retryAfterSeconds,
        campaignsUpdated: touchedCampaigns.size,
    };
}
