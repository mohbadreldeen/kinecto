import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/messaging/webhook/route";
import { db } from "@/lib/db";
import { campaigns, customers, messages, tenants } from "@/lib/db/schema";

describe("POST /api/messaging/webhook", () => {
    const createdTenantIds = new Set<string>();
    let campaignId = "";
    let externalId = "";
    let customerId = "";
    let customerPhone = "";

    beforeEach(async () => {
        process.env.MESSAGING_WEBHOOK_SECRET = "test-webhook-secret";

        const tenantId = randomUUID();
        const slug = `webhook-${tenantId.slice(0, 8)}`;

        await db.insert(tenants).values({
            id: tenantId,
            name: "Webhook Test Tenant",
            slug,
            settings: {},
            brandColors: {},
        });
        createdTenantIds.add(tenantId);

        customerId = randomUUID();
        customerPhone = `+1${randomUUID().replace(/-/g, "").slice(0, 9)}`;
        await db.insert(customers).values({
            id: customerId,
            tenantId,
            name: "Webhook Customer",
            phone: customerPhone,
            email: `webhook_${randomUUID()}@example.com`,
            status: "active",
        });

        const [createdCampaign] = await db
            .insert(campaigns)
            .values({
                tenantId,
                name: "Webhook Campaign",
                channel: "whatsapp",
                templateBody: "Hello",
                audienceType: "manual",
                audienceCriteria: { selectedCustomerIds: [customerId] },
                status: "sending",
                stats: { queued: 0, sent: 1, delivered: 0, failed: 0 },
            })
            .returning({ id: campaigns.id });

        campaignId = createdCampaign.id;
        externalId = `wa_mock_${randomUUID()}`;

        await db.insert(messages).values({
            tenantId,
            campaignId,
            customerId,
            channel: "whatsapp",
            content: "Hello",
            status: "sent",
            externalId,
            sentAt: new Date(),
        });
    });

    afterAll(async () => {
        for (const tenantId of createdTenantIds) {
            await db.delete(messages).where(eq(messages.tenantId, tenantId));
            await db.delete(campaigns).where(eq(campaigns.tenantId, tenantId));
            await db.delete(customers).where(eq(customers.tenantId, tenantId));
            await db.delete(tenants).where(eq(tenants.id, tenantId));
        }

        createdTenantIds.clear();
    });

    it("applies delivered status updates and refreshes campaign stats", async () => {
        const request = new NextRequest(
            "http://localhost:3000/api/messaging/webhook",
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-kinecto-webhook-secret": "test-webhook-secret",
                },
                body: JSON.stringify({
                    events: [
                        {
                            externalId,
                            status: "delivered",
                        },
                    ],
                }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.processed).toBe(1);
        expect(body.data.unsubscribed).toBe(0);

        const message = await db.query.messages.findFirst({
            where: (table, { eq }) => eq(table.externalId, externalId),
        });
        expect(message?.status).toBe("delivered");
        expect(message?.deliveredAt).not.toBeNull();

        const campaign = await db.query.campaigns.findFirst({
            where: (table, { eq }) => eq(table.id, campaignId),
        });
        expect(campaign?.status).toBe("sent");
        expect(campaign?.stats).toMatchObject({
            sent: 1,
            delivered: 1,
            failed: 0,
        });
    });

    it("rejects invalid webhook secret", async () => {
        const request = new NextRequest(
            "http://localhost:3000/api/messaging/webhook",
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-kinecto-webhook-secret": "wrong",
                },
                body: JSON.stringify({
                    events: [
                        {
                            externalId,
                            status: "delivered",
                        },
                    ],
                }),
            }
        );

        const response = await POST(request);
        expect(response.status).toBe(401);
    });

    it("marks customers as unsubscribed on inbound STOP replies", async () => {
        const request = new NextRequest(
            "http://localhost:3000/api/messaging/webhook",
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-kinecto-webhook-secret": "test-webhook-secret",
                },
                body: JSON.stringify({
                    optOutEvents: [
                        {
                            channel: "whatsapp",
                            from: customerPhone,
                            text: "STOP",
                        },
                    ],
                }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.processed).toBe(0);
        expect(body.data.matched).toBe(0);
        expect(body.data.unsubscribed).toBe(1);

        const customer = await db.query.customers.findFirst({
            where: (table, { eq }) => eq(table.id, customerId),
        });
        expect(customer?.unsubscribed).toBe(true);
    });

    it("matches broader opt-out phrases after normalization", async () => {
        const request = new NextRequest(
            "http://localhost:3000/api/messaging/webhook",
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-kinecto-webhook-secret": "test-webhook-secret",
                },
                body: JSON.stringify({
                    optOutEvents: [
                        {
                            channel: "whatsapp",
                            from: customerPhone,
                            text: "Please unsubscribe!!!",
                        },
                    ],
                }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.unsubscribed).toBe(1);

        const customer = await db.query.customers.findFirst({
            where: (table, { eq }) => eq(table.id, customerId),
        });
        expect(customer?.unsubscribed).toBe(true);
    });

    it("maps Meta status webhook payloads into internal events", async () => {
        const request = new NextRequest(
            "http://localhost:3000/api/messaging/webhook",
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-kinecto-webhook-secret": "test-webhook-secret",
                },
                body: JSON.stringify({
                    object: "whatsapp_business_account",
                    entry: [
                        {
                            id: "acct-1",
                            changes: [
                                {
                                    field: "messages",
                                    value: {
                                        statuses: [
                                            {
                                                id: externalId,
                                                status: "read",
                                                timestamp: "1711229340",
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.processed).toBe(1);

        const message = await db.query.messages.findFirst({
            where: (table, { eq }) => eq(table.externalId, externalId),
        });
        expect(message?.status).toBe("read");
        expect(message?.deliveredAt).not.toBeNull();
    });

    it("maps Meta inbound STOP replies into opt-out updates", async () => {
        const request = new NextRequest(
            "http://localhost:3000/api/messaging/webhook",
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-kinecto-webhook-secret": "test-webhook-secret",
                },
                body: JSON.stringify({
                    object: "whatsapp_business_account",
                    entry: [
                        {
                            id: "acct-1",
                            changes: [
                                {
                                    field: "messages",
                                    value: {
                                        messages: [
                                            {
                                                from: customerPhone,
                                                id: `wamid_${randomUUID()}`,
                                                timestamp: "1711229400",
                                                type: "text",
                                                text: {
                                                    body: "STOP",
                                                },
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.unsubscribed).toBe(1);

        const customer = await db.query.customers.findFirst({
            where: (table, { eq }) => eq(table.id, customerId),
        });
        expect(customer?.unsubscribed).toBe(true);
    });

    it("matches localized opt-out phrases from provider payloads", async () => {
        const request = new NextRequest(
            "http://localhost:3000/api/messaging/webhook",
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-kinecto-webhook-secret": "test-webhook-secret",
                },
                body: JSON.stringify({
                    object: "whatsapp_business_account",
                    entry: [
                        {
                            id: "acct-1",
                            changes: [
                                {
                                    field: "messages",
                                    value: {
                                        messages: [
                                            {
                                                from: customerPhone,
                                                id: `wamid_${randomUUID()}`,
                                                timestamp: "1711229400",
                                                type: "text",
                                                text: {
                                                    body: "Baja.",
                                                },
                                            },
                                        ],
                                    },
                                },
                            ],
                        },
                    ],
                }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.unsubscribed).toBe(1);

        const customer = await db.query.customers.findFirst({
            where: (table, { eq }) => eq(table.id, customerId),
        });
        expect(customer?.unsubscribed).toBe(true);
    });

    it("maps Twilio status callbacks into internal events", async () => {
        const request = new NextRequest(
            "http://localhost:3000/api/messaging/webhook",
            {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    "x-kinecto-webhook-secret": "test-webhook-secret",
                },
                body: new URLSearchParams({
                    MessageSid: externalId,
                    MessageStatus: "delivered",
                }).toString(),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.processed).toBe(1);

        const message = await db.query.messages.findFirst({
            where: (table, { eq }) => eq(table.externalId, externalId),
        });
        expect(message?.status).toBe("delivered");
        expect(message?.deliveredAt).not.toBeNull();
    });

    it("maps Twilio inbound STOP replies into opt-out updates", async () => {
        const request = new NextRequest(
            "http://localhost:3000/api/messaging/webhook",
            {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded",
                    "x-kinecto-webhook-secret": "test-webhook-secret",
                },
                body: new URLSearchParams({
                    SmsStatus: "received",
                    From: `whatsapp:${customerPhone}`,
                    Body: "STOP",
                }).toString(),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.unsubscribed).toBe(1);

        const customer = await db.query.customers.findFirst({
            where: (table, { eq }) => eq(table.id, customerId),
        });
        expect(customer?.unsubscribed).toBe(true);
    });

    it("maps Infobip status callbacks into internal events", async () => {
        const request = new NextRequest(
            "http://localhost:3000/api/messaging/webhook",
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-kinecto-webhook-secret": "test-webhook-secret",
                },
                body: JSON.stringify({
                    results: [
                        {
                            messageId: externalId,
                            doneAt: "2026-03-23T10:00:00.000Z",
                            status: {
                                groupName: "DELIVERED",
                                name: "DELIVERED_TO_HANDSET",
                                description: "Message delivered to handset",
                            },
                        },
                    ],
                }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.processed).toBe(1);

        const message = await db.query.messages.findFirst({
            where: (table, { eq }) => eq(table.externalId, externalId),
        });
        expect(message?.status).toBe("delivered");
        expect(message?.deliveredAt).not.toBeNull();
    });

    it("maps Infobip inbound STOP replies into opt-out updates", async () => {
        const request = new NextRequest(
            "http://localhost:3000/api/messaging/webhook",
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-kinecto-webhook-secret": "test-webhook-secret",
                },
                body: JSON.stringify({
                    results: [
                        {
                            from: customerPhone,
                            receivedAt: "2026-03-23T10:05:00.000Z",
                            message: {
                                type: "TEXT",
                                text: "STOP",
                            },
                        },
                    ],
                }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.unsubscribed).toBe(1);

        const customer = await db.query.customers.findFirst({
            where: (table, { eq }) => eq(table.id, customerId),
        });
        expect(customer?.unsubscribed).toBe(true);
    });
});
