import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { processTenantQueue } from "@/lib/messaging/process-queue";

const payloadSchema = z.object({
    limit: z.number().int().min(1).max(500).optional(),
    tenantId: z.string().uuid().optional(),
    campaignId: z.string().uuid().optional(),
    processAllCampaigns: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({}));
    const parsedBody = payloadSchema.safeParse(body);
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: "Invalid payload",
                details: parsedBody.error.flatten(),
            },
            { status: 400 }
        );
    }

    const jobSecret = process.env.MESSAGING_JOB_SECRET?.trim();
    const authHeaderSecret = request.headers
        .get("x-kinecto-job-secret")
        ?.trim();

    let tenantId = parsedBody.data.tenantId;

    if (jobSecret && authHeaderSecret && authHeaderSecret === jobSecret) {
        if (!tenantId) {
            return NextResponse.json(
                { error: "tenantId is required when using job secret" },
                { status: 400 }
            );
        }
    } else {
        const tenantResult = await requireTenantContext();
        if (!("context" in tenantResult)) {
            return tenantResult.response;
        }

        if (tenantResult.context.role !== "owner") {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        tenantId = tenantResult.context.tenantId;
    }

    const limit = parsedBody.data.limit ?? 100;

    // Prevent conflicting parameters
    if (parsedBody.data.campaignId && parsedBody.data.processAllCampaigns) {
        return NextResponse.json(
            {
                error: "Cannot specify both campaignId and processAllCampaigns",
            },
            { status: 400 }
        );
    }

    // Handle bulk processing all campaigns
    if (parsedBody.data.processAllCampaigns) {
        const tenantCampaigns = await db
            .select({ id: campaigns.id })
            .from(campaigns)
            .where(eq(campaigns.tenantId, tenantId));

        const aggregatedResult = {
            tenantId,
            processCampaigns: tenantCampaigns.length,
            totalProcessed: 0,
            totalSent: 0,
            totalFailed: 0,
            totalDeferred: 0,
            campaignsRateLimited: 0,
            campaignResults: [] as Array<{
                campaignId: string;
                processed: number;
                sent: number;
                failed: number;
                deferred: number;
                rateLimited: boolean;
            }>,
        };

        for (const campaign of tenantCampaigns) {
            const campaignResult = await processTenantQueue(
                tenantId,
                limit,
                campaign.id
            );

            // Update campaign's lastQueueRun
            await db
                .update(campaigns)
                .set({
                    lastQueueRun: {
                        runAt: new Date().toISOString(),
                        processed: campaignResult.processed,
                        sent: campaignResult.sent,
                        failed: campaignResult.failed,
                        deferred: campaignResult.deferred,
                        rateLimited: campaignResult.rateLimited,
                        retryAfterSeconds: campaignResult.retryAfterSeconds,
                    },
                    updatedAt: new Date(),
                })
                .where(eq(campaigns.id, campaign.id));

            // Aggregate
            aggregatedResult.totalProcessed += campaignResult.processed;
            aggregatedResult.totalSent += campaignResult.sent;
            aggregatedResult.totalFailed += campaignResult.failed;
            aggregatedResult.totalDeferred += campaignResult.deferred;
            if (campaignResult.rateLimited) {
                aggregatedResult.campaignsRateLimited += 1;
            }

            aggregatedResult.campaignResults.push({
                campaignId: campaign.id,
                processed: campaignResult.processed,
                sent: campaignResult.sent,
                failed: campaignResult.failed,
                deferred: campaignResult.deferred,
                rateLimited: campaignResult.rateLimited,
            });
        }

        return NextResponse.json({ data: aggregatedResult });
    }

    // Handle single campaign or tenant-wide processing
    const result = await processTenantQueue(
        tenantId,
        limit,
        parsedBody.data.campaignId
    );

    if (parsedBody.data.campaignId) {
        await db
            .update(campaigns)
            .set({
                lastQueueRun: {
                    runAt: new Date().toISOString(),
                    processed: result.processed,
                    sent: result.sent,
                    failed: result.failed,
                    deferred: result.deferred,
                    rateLimited: result.rateLimited,
                    retryAfterSeconds: result.retryAfterSeconds,
                },
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(campaigns.id, parsedBody.data.campaignId),
                    eq(campaigns.tenantId, tenantId)
                )
            );
    }

    return NextResponse.json({ data: result });
}
