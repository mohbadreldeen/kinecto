import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import {
    campaigns,
    customers,
    messages,
    tenants,
    users,
} from "@/lib/db/schema";

let mockUser: {
    id: string;
    app_metadata?: { tenantId?: string };
} | null = null;

vi.mock("@/lib/supabase/server", () => ({
    createClient: async () => ({
        auth: {
            getUser: async () => ({
                data: { user: mockUser },
                error: mockUser ? null : new Error("Unauthorized"),
            }),
        },
    }),
}));

import { GET } from "./route";

const createdTenantIds = new Set<string>();

async function createTenantOwner(input: { tenantName: string }) {
    const authUserId = randomUUID();
    const slug = `test-${input.tenantName.toLowerCase()}-${randomUUID().slice(0, 8)}`;

    const [tenant] = await db
        .insert(tenants)
        .values({
            name: input.tenantName,
            slug,
            settings: {},
            brandColors: {},
        })
        .returning({ id: tenants.id });

    createdTenantIds.add(tenant.id);

    await db.insert(users).values({
        tenantId: tenant.id,
        authUserId,
        email: `${slug}@example.test`,
        fullName: `${input.tenantName} Owner`,
        role: "owner",
        status: "active",
    });

    return {
        tenantId: tenant.id,
        authUserId,
    };
}

beforeEach(() => {
    mockUser = null;
});

afterEach(async () => {
    if (createdTenantIds.size === 0) return;

    for (const tenantId of createdTenantIds) {
        await db.delete(messages).where(eq(messages.tenantId, tenantId));
        await db.delete(campaigns).where(eq(campaigns.tenantId, tenantId));
        await db.delete(customers).where(eq(customers.tenantId, tenantId));
        await db.delete(users).where(eq(users.tenantId, tenantId));
        await db.delete(tenants).where(eq(tenants.id, tenantId));
    }

    createdTenantIds.clear();
});

describe("/api/campaigns/[id]", () => {
    it("returns campaign detail for the tenant owner", async () => {
        const tenant = await createTenantOwner({
            tenantName: "Tenant Campaign Detail",
        });

        const [campaign] = await db
            .insert(campaigns)
            .values({
                tenantId: tenant.tenantId,
                name: "Detail Campaign",
                channel: "whatsapp",
                templateBody: "Hi {{customer_name}}",
                audienceType: "manual",
                audienceCriteria: {
                    selectedCustomerIds: [randomUUID(), randomUUID()],
                },
                status: "draft",
                stats: { queued: 0, sent: 10, delivered: 8, failed: 2 },
                lastQueueRun: {
                    runAt: new Date().toISOString(),
                    processed: 4,
                    sent: 3,
                    failed: 0,
                    deferred: 1,
                    rateLimited: true,
                    retryAfterSeconds: 120,
                },
            })
            .returning({ id: campaigns.id });

        const [customerA, customerB] = await db
            .insert(customers)
            .values([
                {
                    tenantId: tenant.tenantId,
                    name: "Detail Alice",
                    phone: `+201${Math.floor(Math.random() * 1_000_000_000)}`,
                    status: "active",
                },
                {
                    tenantId: tenant.tenantId,
                    name: "Detail Bob",
                    phone: `+202${Math.floor(Math.random() * 1_000_000_000)}`,
                    status: "active",
                },
            ])
            .returning({ id: customers.id });

        await db.insert(messages).values([
            {
                tenantId: tenant.tenantId,
                campaignId: campaign.id,
                customerId: customerA.id,
                channel: "whatsapp",
                content: "queued now",
                status: "queued",
                attemptCount: 0,
                nextAttemptAt: null,
            },
            {
                tenantId: tenant.tenantId,
                campaignId: campaign.id,
                customerId: customerB.id,
                channel: "whatsapp",
                content: "queued later",
                status: "queued",
                attemptCount: 1,
                nextAttemptAt: new Date(Date.now() + 10 * 60_000),
            },
        ]);

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const response = await GET(new Request("http://localhost"), {
            params: Promise.resolve({ id: campaign.id }),
        });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.name).toBe("Detail Campaign");
        expect(body.data.stats.delivered).toBe(8);
        expect(body.data.audienceSize).toBe(2);
        expect(body.data.queueBreakdown).toMatchObject({
            queuedDueNow: 1,
            queuedDeferred: 1,
        });
        expect(body.data.queueBreakdown.nextRetryAt).toBeTruthy();
        expect(body.data.lastQueueRun).toMatchObject({
            processed: 4,
            sent: 3,
            failed: 0,
            deferred: 1,
            rateLimited: true,
            retryAfterSeconds: 120,
        });
    });

    it("does not allow access to another tenant campaign", async () => {
        const tenantA = await createTenantOwner({
            tenantName: "Tenant Campaign A",
        });
        const tenantB = await createTenantOwner({
            tenantName: "Tenant Campaign B",
        });

        const [campaign] = await db
            .insert(campaigns)
            .values({
                tenantId: tenantA.tenantId,
                name: "Tenant A Campaign",
                channel: "email",
                templateBody: "Hello",
                audienceType: "all",
                audienceCriteria: {},
                status: "draft",
            })
            .returning({ id: campaigns.id });

        mockUser = {
            id: tenantB.authUserId,
            app_metadata: { tenantId: tenantB.tenantId },
        };

        const response = await GET(new Request("http://localhost"), {
            params: Promise.resolve({ id: campaign.id }),
        });

        expect(response.status).toBe(404);
    });
});
