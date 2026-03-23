import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/messaging/process-queue/route";
import { db } from "@/lib/db";
import {
    apiKeys,
    campaigns,
    customers,
    messages,
    tenants,
} from "@/lib/db/schema";
import { encryptSecret } from "@/lib/security/secrets";

const { mockRequireTenantContext } = vi.hoisted(() => ({
    mockRequireTenantContext: vi.fn(),
}));

vi.mock("@/lib/api/tenant-context", () => ({
    requireTenantContext: mockRequireTenantContext,
}));

describe("POST /api/messaging/process-queue", () => {
    const createdTenantIds = new Set<string>();
    let tenantId = "";
    let campaignId = "";
    const originalMockMode = process.env.MESSAGING_MOCK_MODE;

    beforeEach(async () => {
        process.env.APP_ENCRYPTION_KEY = "a".repeat(32);

        tenantId = randomUUID();
        const slug = `queue-${tenantId.slice(0, 8)}`;

        await db.insert(tenants).values({
            id: tenantId,
            name: "Queue Test Tenant",
            slug,
            settings: {},
            brandColors: {},
        });
        createdTenantIds.add(tenantId);

        const customerAId = randomUUID();
        const customerBId = randomUUID();

        await db.insert(customers).values([
            {
                id: customerAId,
                tenantId,
                name: "Alice Queue",
                phone: "+111111111",
                email: `alice_${randomUUID()}@example.com`,
                status: "active",
            },
            {
                id: customerBId,
                tenantId,
                name: "Bob Queue",
                phone: "+122222222",
                email: `bob_${randomUUID()}@example.com`,
                status: "active",
            },
        ]);

        const [createdCampaign] = await db
            .insert(campaigns)
            .values({
                tenantId,
                name: "Queue Campaign",
                channel: "whatsapp",
                templateBody: "Hello queue",
                audienceType: "manual",
                audienceCriteria: {
                    selectedCustomerIds: [customerAId, customerBId],
                },
                status: "sending",
                stats: {
                    queued: 2,
                    sent: 0,
                    delivered: 0,
                    failed: 0,
                },
            })
            .returning({ id: campaigns.id });

        campaignId = createdCampaign.id;

        await db.insert(apiKeys).values({
            tenantId,
            service: "whatsapp",
            encryptedKey: encryptSecret(
                JSON.stringify({
                    baseUrl: "https://example.test",
                    apiKey: "wa_key",
                    senderId: "sender",
                })
            ),
            isActive: "true",
        });

        await db.insert(messages).values([
            {
                tenantId,
                campaignId,
                customerId: customerAId,
                channel: "whatsapp",
                content: "Hello Alice",
                status: "queued",
            },
            {
                tenantId,
                campaignId,
                customerId: customerBId,
                channel: "whatsapp",
                content: "Hello Bob",
                status: "queued",
            },
        ]);

        mockRequireTenantContext.mockReset();
        mockRequireTenantContext.mockResolvedValue({
            context: {
                userId: randomUUID(),
                tenantId,
                role: "owner",
            },
        });
    });

    afterAll(async () => {
        if (originalMockMode === undefined) {
            delete process.env.MESSAGING_MOCK_MODE;
        } else {
            process.env.MESSAGING_MOCK_MODE = originalMockMode;
        }

        for (const id of createdTenantIds) {
            await db.delete(messages).where(eq(messages.tenantId, id));
            await db.delete(campaigns).where(eq(campaigns.tenantId, id));
            await db.delete(customers).where(eq(customers.tenantId, id));
            await db.delete(apiKeys).where(eq(apiKeys.tenantId, id));
            await db.delete(tenants).where(eq(tenants.id, id));
        }

        createdTenantIds.clear();
    });

    it("processes queued messages and updates campaign stats", async () => {
        const request = new NextRequest(
            "http://localhost:3000/api/messaging/process-queue",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ limit: 50 }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.processed).toBe(2);
        expect(body.data.sent).toBe(2);
        expect(body.data.failed).toBe(0);

        const processedMessages = await db.query.messages.findMany({
            where: (table, { eq }) => eq(table.campaignId, campaignId),
        });
        expect(processedMessages.every((row) => row.status === "sent")).toBe(
            true
        );
        expect(processedMessages.every((row) => Boolean(row.externalId))).toBe(
            true
        );

        const campaign = await db.query.campaigns.findFirst({
            where: (table, { eq }) => eq(table.id, campaignId),
        });
        expect(campaign?.status).toBe("sent");
        expect(campaign?.stats).toMatchObject({
            sent: 2,
            delivered: 0,
            failed: 0,
        });
    });

    it("pauses queue processing on rate-limited provider responses", async () => {
        process.env.MESSAGING_MOCK_MODE = "off";

        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(JSON.stringify({ error: "Rate limit" }), {
                status: 429,
                headers: {
                    "content-type": "application/json",
                    "retry-after": "120",
                },
            })
        );

        const request = new NextRequest(
            "http://localhost:3000/api/messaging/process-queue",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ limit: 50 }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.processed).toBe(1);
        expect(body.data.sent).toBe(0);
        expect(body.data.failed).toBe(0);
        expect(body.data.deferred).toBe(2);
        expect(body.data.rateLimited).toBe(true);
        expect(body.data.retryAfterSeconds).toBe(120);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        fetchMock.mockRestore();
        delete process.env.MESSAGING_MOCK_MODE;

        const queuedMessages = await db.query.messages.findMany({
            where: (table, { eq }) => eq(table.campaignId, campaignId),
        });
        expect(queuedMessages.every((row) => row.status === "queued")).toBe(
            true
        );
        expect(
            queuedMessages.filter((row) => row.nextAttemptAt !== null)
        ).toHaveLength(1);
        expect(
            queuedMessages.find((row) => row.nextAttemptAt !== null)
                ?.attemptCount
        ).toBe(1);
        expect(
            queuedMessages.find((row) => row.nextAttemptAt === null)
                ?.attemptCount
        ).toBe(0);

        const campaign = await db.query.campaigns.findFirst({
            where: (table, { eq }) => eq(table.id, campaignId),
        });
        expect(campaign?.status).toBe("sending");
        expect(campaign?.stats).toMatchObject({
            queued: 2,
            sent: 0,
            delivered: 0,
            failed: 0,
        });
    });

    it("skips queued messages that are not due yet", async () => {
        const existingMessages = await db.query.messages.findMany({
            where: (table, { eq }) => eq(table.campaignId, campaignId),
        });

        const deferredMessage = existingMessages.find(
            (row) => row.content === "Hello Bob"
        );

        expect(deferredMessage).toBeTruthy();

        await db
            .update(messages)
            .set({
                attemptCount: 1,
                nextAttemptAt: new Date(Date.now() + 5 * 60_000),
            })
            .where(eq(messages.id, deferredMessage!.id));

        const request = new NextRequest(
            "http://localhost:3000/api/messaging/process-queue",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ limit: 50 }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.processed).toBe(1);
        expect(body.data.sent).toBe(1);
        expect(body.data.failed).toBe(0);
        expect(body.data.deferred).toBe(0);
        expect(body.data.rateLimited).toBe(false);

        const processedMessages = await db.query.messages.findMany({
            where: (table, { eq }) => eq(table.campaignId, campaignId),
        });
        const sentMessage = processedMessages.find(
            (row) => row.content === "Hello Alice"
        );
        const queuedMessage = processedMessages.find(
            (row) => row.content === "Hello Bob"
        );

        expect(sentMessage?.status).toBe("sent");
        expect(sentMessage?.attemptCount).toBe(1);
        expect(queuedMessage?.status).toBe("queued");
        expect(queuedMessage?.attemptCount).toBe(1);
        expect(queuedMessage?.nextAttemptAt).not.toBeNull();

        const campaign = await db.query.campaigns.findFirst({
            where: (table, { eq }) => eq(table.id, campaignId),
        });
        expect(campaign?.status).toBe("sending");
        expect(campaign?.stats).toMatchObject({
            queued: 1,
            sent: 1,
            delivered: 0,
            failed: 0,
        });
    });

    it("marks message failed after max retry attempts and continues batch", async () => {
        process.env.MESSAGING_MOCK_MODE = "off";

        const existingMessages = await db.query.messages.findMany({
            where: (table, { eq }) => eq(table.campaignId, campaignId),
        });

        const retryLimitMessage = existingMessages.find(
            (row) => row.content === "Hello Alice"
        );

        expect(retryLimitMessage).toBeTruthy();

        await db
            .update(messages)
            .set({
                attemptCount: 4,
                nextAttemptAt: null,
            })
            .where(eq(messages.id, retryLimitMessage!.id));

        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ error: "Rate limit" }), {
                    status: 429,
                    headers: {
                        "content-type": "application/json",
                        "retry-after": "120",
                    },
                })
            )
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ id: "wa_sent_2" }), {
                    status: 200,
                    headers: {
                        "content-type": "application/json",
                    },
                })
            );

        const request = new NextRequest(
            "http://localhost:3000/api/messaging/process-queue",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ limit: 50 }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.processed).toBe(2);
        expect(body.data.sent).toBe(1);
        expect(body.data.failed).toBe(1);
        expect(body.data.deferred).toBe(0);
        expect(body.data.rateLimited).toBe(false);
        expect(fetchMock).toHaveBeenCalledTimes(2);

        fetchMock.mockRestore();
        delete process.env.MESSAGING_MOCK_MODE;

        const processedMessages = await db.query.messages.findMany({
            where: (table, { eq }) => eq(table.campaignId, campaignId),
        });

        const failedMessage = processedMessages.find(
            (row) => row.content === "Hello Alice"
        );
        const sentMessage = processedMessages.find(
            (row) => row.content === "Hello Bob"
        );

        expect(failedMessage?.status).toBe("failed");
        expect(failedMessage?.attemptCount).toBe(5);
        expect(failedMessage?.nextAttemptAt).toBeNull();

        expect(sentMessage?.status).toBe("sent");
        expect(sentMessage?.attemptCount).toBe(1);
        expect(sentMessage?.nextAttemptAt).toBeNull();

        const campaign = await db.query.campaigns.findFirst({
            where: (table, { eq }) => eq(table.id, campaignId),
        });

        expect(campaign?.status).toBe("sent");
        expect(campaign?.stats).toMatchObject({
            queued: 0,
            sent: 1,
            delivered: 0,
            failed: 1,
        });
    });

    it("processes only the selected campaign when campaignId is provided", async () => {
        const [otherCampaign] = await db
            .insert(campaigns)
            .values({
                tenantId,
                name: "Other Queue Campaign",
                channel: "whatsapp",
                templateBody: "Hello other",
                audienceType: "manual",
                audienceCriteria: { selectedCustomerIds: [] },
                status: "sending",
                stats: {
                    queued: 1,
                    sent: 0,
                    delivered: 0,
                    failed: 0,
                },
            })
            .returning({ id: campaigns.id });

        const firstCampaignMessage = await db.query.messages.findFirst({
            where: (table, { and, eq }) =>
                and(
                    eq(table.campaignId, campaignId),
                    eq(table.content, "Hello Alice")
                ),
        });

        expect(firstCampaignMessage).toBeTruthy();

        await db.insert(messages).values({
            tenantId,
            campaignId: otherCampaign.id,
            customerId: firstCampaignMessage!.customerId,
            channel: "whatsapp",
            content: "Hello other",
            status: "queued",
        });

        const request = new NextRequest(
            "http://localhost:3000/api/messaging/process-queue",
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    limit: 50,
                    campaignId,
                }),
            }
        );

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.processed).toBe(2);
        expect(body.data.sent).toBe(2);
        expect(body.data.failed).toBe(0);
        expect(body.data.campaignsUpdated).toBe(1);

        const processedCampaignMessages = await db.query.messages.findMany({
            where: (table, { eq }) => eq(table.campaignId, campaignId),
        });
        expect(
            processedCampaignMessages.every((row) => row.status === "sent")
        ).toBe(true);

        const untouchedOtherMessage = await db.query.messages.findFirst({
            where: (table, { and, eq }) =>
                and(
                    eq(table.campaignId, otherCampaign.id),
                    eq(table.content, "Hello other")
                ),
        });
        expect(untouchedOtherMessage?.status).toBe("queued");

        const updatedCampaign = await db.query.campaigns.findFirst({
            where: (table, { eq }) => eq(table.id, campaignId),
        });
        expect(updatedCampaign?.lastQueueRun).toMatchObject({
            processed: 2,
            sent: 2,
            failed: 0,
            deferred: 0,
            rateLimited: false,
        });
    });
});
