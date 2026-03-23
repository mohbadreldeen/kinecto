import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
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

import { GET, POST } from "./route";

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

describe("/api/campaigns", () => {
    it("creates a manual audience draft campaign", async () => {
        const tenant = await createTenantOwner({
            tenantName: "Tenant Campaign",
        });

        const [customer] = await db
            .insert(customers)
            .values({
                tenantId: tenant.tenantId,
                name: "Manual Audience Customer",
                phone: "+201099900001",
                status: "active",
            })
            .returning({ id: customers.id });

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest("http://localhost:3000/api/campaigns", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                name: "Manual draft",
                channel: "whatsapp",
                templateBody: "Hello {{customer_name}}",
                audienceType: "manual",
                audienceCriteria: {
                    selectedCustomerIds: [customer.id],
                },
            }),
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(body.data.name).toBe("Manual draft");
        expect(body.data.status).toBe("draft");
    });

    it("lists tenant campaigns", async () => {
        const tenant = await createTenantOwner({
            tenantName: "Tenant Campaign List",
        });

        const [campaign] = await db
            .insert(campaigns)
            .values({
                tenantId: tenant.tenantId,
                name: "Seed Campaign",
                channel: "email",
                templateBody: "Template",
                audienceType: "all",
                audienceCriteria: {},
                status: "draft",
            })
            .returning({ id: campaigns.id });

        const [customerA, customerB] = await db
            .insert(customers)
            .values([
                {
                    tenantId: tenant.tenantId,
                    name: "List Alice",
                    phone: "+201099900901",
                    status: "active",
                },
                {
                    tenantId: tenant.tenantId,
                    name: "List Bob",
                    phone: "+201099900902",
                    status: "active",
                },
            ])
            .returning({ id: customers.id });

        await db.insert(messages).values([
            {
                tenantId: tenant.tenantId,
                campaignId: campaign.id,
                customerId: customerA.id,
                channel: "email",
                content: "queued now",
                status: "queued",
                nextAttemptAt: null,
            },
            {
                tenantId: tenant.tenantId,
                campaignId: campaign.id,
                customerId: customerB.id,
                channel: "email",
                content: "queued later",
                status: "queued",
                nextAttemptAt: new Date(Date.now() + 5 * 60_000),
            },
        ]);

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].name).toBe("Seed Campaign");
        expect(body.data[0].queueBreakdown).toMatchObject({
            queuedDueNow: 1,
            queuedDeferred: 1,
        });
        expect(body.data[0].queueBreakdown.nextRetryAt).toBeTruthy();
    });
});
