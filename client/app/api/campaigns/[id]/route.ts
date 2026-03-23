import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import { campaigns, messages } from "@/lib/db/schema";

const paramsSchema = z.object({
    id: z.string().uuid(),
});

export async function GET(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    if (tenantResult.context.role !== "owner") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = await context.params;
    const parsedParams = paramsSchema.safeParse(params);
    if (!parsedParams.success) {
        return NextResponse.json(
            {
                error: "Invalid campaign id",
                details: parsedParams.error.flatten(),
            },
            { status: 400 }
        );
    }

    const campaign = await db
        .select({
            id: campaigns.id,
            name: campaigns.name,
            channel: campaigns.channel,
            templateBody: campaigns.templateBody,
            audienceType: campaigns.audienceType,
            audienceCriteria: campaigns.audienceCriteria,
            status: campaigns.status,
            stats: campaigns.stats,
            lastQueueRun: campaigns.lastQueueRun,
            scheduledAt: campaigns.scheduledAt,
            sentAt: campaigns.sentAt,
            createdAt: campaigns.createdAt,
            updatedAt: campaigns.updatedAt,
        })
        .from(campaigns)
        .where(
            and(
                eq(campaigns.id, parsedParams.data.id),
                eq(campaigns.tenantId, tenantResult.context.tenantId)
            )
        )
        .limit(1)
        .then((rows) => rows[0]);

    if (!campaign) {
        return NextResponse.json(
            { error: "Campaign not found" },
            { status: 404 }
        );
    }

    const selectedCustomerIds = Array.isArray(
        campaign.audienceCriteria?.selectedCustomerIds
    )
        ? campaign.audienceCriteria.selectedCustomerIds
        : [];

    const now = new Date();
    const campaignMessages = await db
        .select({
            status: messages.status,
            nextAttemptAt: messages.nextAttemptAt,
        })
        .from(messages)
        .where(eq(messages.campaignId, campaign.id));

    const queuedMessages = campaignMessages.filter(
        (row) => row.status === "queued"
    );
    const queuedDueNow = queuedMessages.filter(
        (row) => !row.nextAttemptAt || row.nextAttemptAt <= now
    ).length;
    const queuedDeferred = queuedMessages.filter(
        (row) => row.nextAttemptAt && row.nextAttemptAt > now
    ).length;
    const nextRetryAt = queuedMessages
        .map((row) => row.nextAttemptAt)
        .filter((value): value is Date => Boolean(value && value > now))
        .sort((a, b) => a.getTime() - b.getTime())[0];

    return NextResponse.json({
        data: {
            ...campaign,
            audienceSize:
                campaign.audienceType === "manual"
                    ? selectedCustomerIds.length
                    : null,
            queueBreakdown: {
                queuedDueNow,
                queuedDeferred,
                nextRetryAt: nextRetryAt ? nextRetryAt.toISOString() : null,
            },
        },
    });
}
