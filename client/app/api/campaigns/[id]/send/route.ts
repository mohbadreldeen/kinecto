import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import {
    apiKeys,
    campaigns,
    customers,
    messages,
    tenants,
} from "@/lib/db/schema";
import {
    isValidEmailAddress,
    isValidWhatsAppPhone,
} from "@/lib/integrations/messaging";
import { processTenantQueue } from "@/lib/messaging/process-queue";
import { decryptSecret } from "@/lib/security/secrets";

const paramsSchema = z.object({
    id: z.string().uuid(),
});

function renderTemplate(
    template: string,
    values: Record<string, string | number>
) {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
        const value = values[key];
        return value === undefined || value === null ? "" : String(value);
    });
}

async function hasIntegrationCredentials(params: {
    tenantId: string;
    service: "whatsapp" | "email";
}) {
    const row = await db.query.apiKeys.findFirst({
        where: and(
            eq(apiKeys.tenantId, params.tenantId),
            eq(apiKeys.service, params.service),
            eq(apiKeys.isActive, "true")
        ),
        columns: {
            encryptedKey: true,
        },
    });

    if (!row?.encryptedKey) {
        return false;
    }

    try {
        const parsed = JSON.parse(decryptSecret(row.encryptedKey)) as Record<
            string,
            unknown
        >;

        if (params.service === "whatsapp") {
            return Boolean(parsed.baseUrl && parsed.apiKey && parsed.senderId);
        }

        return Boolean(parsed.provider && parsed.apiKey && parsed.fromEmail);
    } catch {
        return false;
    }
}

export async function POST(
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
            tenantId: campaigns.tenantId,
            name: campaigns.name,
            channel: campaigns.channel,
            templateBody: campaigns.templateBody,
            audienceType: campaigns.audienceType,
            audienceCriteria: campaigns.audienceCriteria,
            status: campaigns.status,
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

    if (campaign.status !== "draft" && campaign.status !== "scheduled") {
        return NextResponse.json(
            { error: "Only draft or scheduled campaigns can be sent" },
            { status: 409 }
        );
    }

    const hasCredentials = await hasIntegrationCredentials({
        tenantId: campaign.tenantId,
        service: campaign.channel,
    });

    if (!hasCredentials) {
        return NextResponse.json(
            {
                error: `Missing active ${campaign.channel} integration credentials`,
            },
            { status: 409 }
        );
    }

    const selectedIds = Array.isArray(
        campaign.audienceCriteria?.selectedCustomerIds
    )
        ? campaign.audienceCriteria.selectedCustomerIds.filter(
              (id): id is string => typeof id === "string"
          )
        : [];

    const audienceRows =
        campaign.audienceType === "all"
            ? await db
                  .select({
                      id: customers.id,
                      name: customers.name,
                      phone: customers.phone,
                      email: customers.email,
                      pointsBalance: customers.pointsBalance,
                  })
                  .from(customers)
                  .where(
                      and(
                          eq(customers.tenantId, campaign.tenantId),
                          eq(customers.status, "active"),
                          eq(customers.unsubscribed, false)
                      )
                  )
            : campaign.audienceType === "manual"
              ? selectedIds.length > 0
                  ? await db
                        .select({
                            id: customers.id,
                            name: customers.name,
                            phone: customers.phone,
                            email: customers.email,
                            pointsBalance: customers.pointsBalance,
                        })
                        .from(customers)
                        .where(
                            and(
                                eq(customers.tenantId, campaign.tenantId),
                                inArray(customers.id, selectedIds),
                                eq(customers.status, "active"),
                                eq(customers.unsubscribed, false)
                            )
                        )
                  : []
              : selectedIds.length > 0
                ? await db
                      .select({
                          id: customers.id,
                          name: customers.name,
                          phone: customers.phone,
                          email: customers.email,
                          pointsBalance: customers.pointsBalance,
                      })
                      .from(customers)
                      .where(
                          and(
                              eq(customers.tenantId, campaign.tenantId),
                              inArray(customers.id, selectedIds),
                              eq(customers.status, "active"),
                              eq(customers.unsubscribed, false)
                          )
                      )
                : [];

    const tenant = await db
        .select({ name: tenants.name })
        .from(tenants)
        .where(eq(tenants.id, campaign.tenantId))
        .limit(1)
        .then((rows) => rows[0]);

    const businessName = tenant?.name ?? "Business";
    const now = new Date();

    const queuedMessages: Array<{
        tenantId: string;
        campaignId: string;
        customerId: string;
        channel: "whatsapp" | "email";
        content: string;
        status: "queued";
    }> = [];

    const failedMessages: Array<{
        tenantId: string;
        campaignId: string;
        customerId: string;
        channel: "whatsapp" | "email";
        content: string;
        status: "failed";
        errorMessage: string;
    }> = [];

    for (const customer of audienceRows) {
        const renderedContent = renderTemplate(campaign.templateBody, {
            customer_name: customer.name,
            first_name: customer.name.split(" ")[0] ?? customer.name,
            points: customer.pointsBalance,
            business_name: businessName,
        });

        if (
            campaign.channel === "whatsapp" &&
            !isValidWhatsAppPhone(customer.phone)
        ) {
            failedMessages.push({
                tenantId: campaign.tenantId,
                campaignId: campaign.id,
                customerId: customer.id,
                channel: campaign.channel,
                content: renderedContent,
                status: "failed",
                errorMessage: "Invalid WhatsApp phone number",
            });
            continue;
        }

        if (campaign.channel === "email" && !customer.email) {
            failedMessages.push({
                tenantId: campaign.tenantId,
                campaignId: campaign.id,
                customerId: customer.id,
                channel: campaign.channel,
                content: renderedContent,
                status: "failed",
                errorMessage: "Missing customer email",
            });
            continue;
        }

        const customerEmail = customer.email ?? "";
        if (
            campaign.channel === "email" &&
            !isValidEmailAddress(customerEmail)
        ) {
            failedMessages.push({
                tenantId: campaign.tenantId,
                campaignId: campaign.id,
                customerId: customer.id,
                channel: campaign.channel,
                content: renderedContent,
                status: "failed",
                errorMessage: "Invalid customer email",
            });
            continue;
        }

        queuedMessages.push({
            tenantId: campaign.tenantId,
            campaignId: campaign.id,
            customerId: customer.id,
            channel: campaign.channel,
            content: renderedContent,
            status: "queued",
        });
    }

    if (queuedMessages.length === 0 && failedMessages.length === 0) {
        return NextResponse.json(
            { error: "Campaign audience is empty" },
            { status: 400 }
        );
    }

    await db.transaction(async (tx) => {
        if (queuedMessages.length > 0) {
            await tx.insert(messages).values(queuedMessages);
        }

        if (failedMessages.length > 0) {
            await tx.insert(messages).values(failedMessages);
        }

        await tx
            .update(campaigns)
            .set({
                status: queuedMessages.length > 0 ? "sending" : "failed",
                sentAt: queuedMessages.length > 0 ? null : now,
                updatedAt: now,
                stats: {
                    queued: queuedMessages.length,
                    sent: 0,
                    delivered: 0,
                    failed: failedMessages.length,
                },
            })
            .where(eq(campaigns.id, campaign.id));
    });

    // Process the queue inline so messages are dispatched immediately
    if (queuedMessages.length > 0) {
        await processTenantQueue(
            campaign.tenantId,
            queuedMessages.length,
            campaign.id
        );
    }

    return NextResponse.json({
        data: {
            campaignId: campaign.id,
            status: queuedMessages.length > 0 ? "sending" : "failed",
            queued: queuedMessages.length,
            failed: failedMessages.length,
        },
    });
}
