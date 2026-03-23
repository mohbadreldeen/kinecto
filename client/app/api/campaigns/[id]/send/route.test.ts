import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/campaigns/[id]/send/route";
import { db } from "@/lib/db";
import {
    apiKeys,
    campaigns,
    customers,
    messages,
    tenants,
} from "@/lib/db/schema";
import { encryptSecret } from "@/lib/security/secrets";

const { mockRequireTenantContext, mockRole } = vi.hoisted(() => ({
    mockRequireTenantContext: vi.fn(),
    mockRole: "owner" as "owner" | "staff",
}));

vi.mock("@/lib/api/tenant-context", () => ({
    requireTenantContext: mockRequireTenantContext,
}));

describe("POST /api/campaigns/[id]/send", () => {
    const createdTenantIds = new Set<string>();
    let campaignId = "";
    let customerAId = "";
    let customerBId = "";
    let tenantId = "";
    const originalEncryptionKey = process.env.APP_ENCRYPTION_KEY;

    afterAll(() => {
        if (originalEncryptionKey === undefined) {
            delete process.env.APP_ENCRYPTION_KEY;
            return;
        }

        process.env.APP_ENCRYPTION_KEY = originalEncryptionKey;
    });

    beforeEach(async () => {
        process.env.APP_ENCRYPTION_KEY = "a".repeat(32);

        tenantId = randomUUID();
        const slug = `send-${tenantId.slice(0, 8)}`;

        await db.insert(tenants).values({
            id: tenantId,
            name: "Send Test Tenant",
            slug,
            settings: {},
            brandColors: {},
        });
        createdTenantIds.add(tenantId);
        campaignId = randomUUID();
        customerAId = randomUUID();
        customerBId = randomUUID();

        mockRequireTenantContext.mockReset();
        mockRequireTenantContext.mockResolvedValue({
            context: {
                userId: randomUUID(),
                tenantId,
                role: mockRole,
            },
        });

        await db.insert(customers).values([
            {
                id: customerAId,
                tenantId,
                name: "Alice Example",
                phone: "+111111111",
                email: `alice_${randomUUID()}@example.com`,
                pointsBalance: 12,
                status: "active",
            },
            {
                id: customerBId,
                tenantId,
                name: "Bob Example",
                phone: "+122222222",
                email: `bob_${randomUUID()}@example.com`,
                pointsBalance: 33,
                status: "active",
            },
        ]);

        const [createdCampaign] = await db
            .insert(campaigns)
            .values({
                tenantId,
                name: "Promo",
                channel: "whatsapp",
                templateBody:
                    "Hello {{first_name}}, you have {{points}} points at {{business_name}}.",
                audienceType: "manual",
                audienceCriteria: {
                    selectedCustomerIds: [customerAId, customerBId],
                },
                status: "draft",
                stats: {
                    queued: 0,
                    sent: 0,
                    delivered: 0,
                    failed: 0,
                },
            })
            .returning({ id: campaigns.id });

        campaignId = createdCampaign.id;
    });

    afterAll(async () => {
        for (const tenantId of createdTenantIds) {
            await db.delete(messages).where(eq(messages.tenantId, tenantId));
            await db.delete(campaigns).where(eq(campaigns.tenantId, tenantId));
            await db.delete(customers).where(eq(customers.tenantId, tenantId));
            await db.delete(apiKeys).where(eq(apiKeys.tenantId, tenantId));
            await db.delete(tenants).where(eq(tenants.id, tenantId));
        }

        createdTenantIds.clear();
    });

    it("queues a draft campaign and creates queued message rows", async () => {
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

        const response = await POST(new Request("http://localhost"), {
            params: Promise.resolve({ id: campaignId }),
        });

        expect(response.status).toBe(200);
        const payload = await response.json();
        expect(payload.data.queued).toBe(2);
        expect(payload.data.failed).toBe(0);

        const campaign = await db.query.campaigns.findFirst({
            where: (table, { eq }) => eq(table.id, campaignId),
        });
        expect(campaign?.status).toBe("sent");
        expect(campaign?.stats).toMatchObject({
            queued: 0,
            sent: 2,
            delivered: 0,
            failed: 0,
        });
        expect(campaign?.sentAt).not.toBeNull();

        const messageRows = await db.query.messages.findMany({
            where: (table, { eq }) => eq(table.campaignId, campaignId),
        });
        expect(messageRows).toHaveLength(2);
        expect(messageRows.every((row) => row.status === "sent")).toBe(true);
        expect(messageRows[0]?.content).toContain("Hello");
    });

    it("returns conflict when integration credentials are missing", async () => {
        const response = await POST(new Request("http://localhost"), {
            params: Promise.resolve({ id: campaignId }),
        });

        expect(response.status).toBe(409);
        const payload = await response.json();
        expect(payload.error).toContain(
            "Missing active whatsapp integration credentials"
        );
    });

    it("returns forbidden for non-owner role", async () => {
        mockRequireTenantContext.mockResolvedValueOnce({
            context: {
                userId: randomUUID(),
                tenantId,
                role: "staff",
            },
        });

        const response = await POST(new Request("http://localhost"), {
            params: Promise.resolve({ id: campaignId }),
        });

        expect(response.status).toBe(403);
    });
});
