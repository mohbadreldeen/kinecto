import { and, count, desc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import { campaigns, customers, messages } from "@/lib/db/schema";

const createCampaignSchema = z
    .object({
        name: z.string().trim().min(2).max(140),
        channel: z.enum(["whatsapp", "email"]),
        templateBody: z.string().trim().min(1).max(4000),
        audienceType: z.enum(["all", "segment", "manual"]),
        audienceCriteria: z.record(z.string(), z.unknown()).default({}),
    })
    .superRefine((value, ctx) => {
        if (value.audienceType !== "manual") {
            return;
        }

        const selectedCustomerIds = z
            .array(z.string().uuid())
            .min(1)
            .safeParse(value.audienceCriteria.selectedCustomerIds);

        if (!selectedCustomerIds.success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Manual audience requires selectedCustomerIds",
                path: ["audienceCriteria", "selectedCustomerIds"],
            });
        }
    });

export async function GET() {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    if (tenantResult.context.role !== "owner") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await db
        .select({
            id: campaigns.id,
            name: campaigns.name,
            channel: campaigns.channel,
            audienceType: campaigns.audienceType,
            status: campaigns.status,
            stats: campaigns.stats,
            createdAt: campaigns.createdAt,
            updatedAt: campaigns.updatedAt,
        })
        .from(campaigns)
        .where(eq(campaigns.tenantId, tenantResult.context.tenantId))
        .orderBy(desc(campaigns.createdAt));

    const now = new Date();
    const campaignIds = rows.map((row) => row.id);
    const queueByCampaign = new Map<
        string,
        {
            queuedDueNow: number;
            queuedDeferred: number;
            nextRetryAt: string | null;
        }
    >();

    if (campaignIds.length > 0) {
        const queuedRows = await db
            .select({
                campaignId: messages.campaignId,
                nextAttemptAt: messages.nextAttemptAt,
            })
            .from(messages)
            .where(
                and(
                    eq(messages.tenantId, tenantResult.context.tenantId),
                    inArray(messages.campaignId, campaignIds),
                    eq(messages.status, "queued")
                )
            );

        for (const row of queuedRows) {
            const current = queueByCampaign.get(row.campaignId) ?? {
                queuedDueNow: 0,
                queuedDeferred: 0,
                nextRetryAt: null,
            };

            if (!row.nextAttemptAt || row.nextAttemptAt <= now) {
                current.queuedDueNow += 1;
            } else {
                current.queuedDeferred += 1;
                if (
                    !current.nextRetryAt ||
                    row.nextAttemptAt.getTime() <
                        new Date(current.nextRetryAt).getTime()
                ) {
                    current.nextRetryAt = row.nextAttemptAt.toISOString();
                }
            }

            queueByCampaign.set(row.campaignId, current);
        }
    }

    return NextResponse.json({
        data: rows.map((row) => ({
            ...row,
            queueBreakdown: queueByCampaign.get(row.id) ?? {
                queuedDueNow: 0,
                queuedDeferred: 0,
                nextRetryAt: null,
            },
        })),
    });
}

export async function POST(request: NextRequest) {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    if (tenantResult.context.role !== "owner") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsedBody = createCampaignSchema.safeParse(body);
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: "Invalid payload",
                details: parsedBody.error.flatten(),
            },
            { status: 400 }
        );
    }

    const payload = parsedBody.data;

    if (payload.audienceType === "manual") {
        const selectedCustomerIds = payload.audienceCriteria
            .selectedCustomerIds as string[];

        const [countResult] = await db
            .select({ value: count() })
            .from(customers)
            .where(
                and(
                    eq(customers.tenantId, tenantResult.context.tenantId),
                    inArray(customers.id, selectedCustomerIds)
                )
            );

        if (Number(countResult?.value ?? 0) !== selectedCustomerIds.length) {
            return NextResponse.json(
                {
                    error: "One or more selected customers are invalid for this tenant",
                },
                { status: 400 }
            );
        }
    }

    const [created] = await db
        .insert(campaigns)
        .values({
            tenantId: tenantResult.context.tenantId,
            name: payload.name,
            channel: payload.channel,
            templateBody: payload.templateBody,
            audienceType: payload.audienceType,
            audienceCriteria: payload.audienceCriteria,
            status: "draft",
            stats: {
                queued: 0,
                sent: 0,
                delivered: 0,
                failed: 0,
            },
            updatedAt: new Date(),
        })
        .returning({
            id: campaigns.id,
            name: campaigns.name,
            channel: campaigns.channel,
            audienceType: campaigns.audienceType,
            audienceCriteria: campaigns.audienceCriteria,
            status: campaigns.status,
            createdAt: campaigns.createdAt,
            updatedAt: campaigns.updatedAt,
        });

    return NextResponse.json({ data: created }, { status: 201 });
}
