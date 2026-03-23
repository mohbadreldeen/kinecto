import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { apiKeys, tenants, users } from "@/lib/db/schema";

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

import { GET, PUT } from "./route";

const createdTenantIds = new Set<string>();
const previousEncryptionKey = process.env.APP_ENCRYPTION_KEY;

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
    process.env.APP_ENCRYPTION_KEY = "test-encryption-key-whatsapp-settings";
});

afterEach(async () => {
    if (createdTenantIds.size > 0) {
        for (const tenantId of createdTenantIds) {
            await db.delete(apiKeys).where(eq(apiKeys.tenantId, tenantId));
            await db.delete(users).where(eq(users.tenantId, tenantId));
            await db.delete(tenants).where(eq(tenants.id, tenantId));
        }

        createdTenantIds.clear();
    }

    if (previousEncryptionKey === undefined) {
        delete process.env.APP_ENCRYPTION_KEY;
    } else {
        process.env.APP_ENCRYPTION_KEY = previousEncryptionKey;
    }
});

describe("/api/settings/integrations/whatsapp", () => {
    it("saves and returns tenant whatsapp settings", async () => {
        const tenant = await createTenantOwner({
            tenantName: "Tenant WhatsApp Settings",
        });

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const saveRequest = new NextRequest(
            "http://localhost:3000/api/settings/integrations/whatsapp",
            {
                method: "PUT",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    label: "Primary",
                    baseUrl: "https://wa.example.com",
                    apiKey: "wa_live_1234567890",
                    senderId: "123456789",
                }),
            }
        );

        const saveResponse = await PUT(saveRequest);
        expect(saveResponse.status).toBe(200);

        const getResponse = await GET();
        const getBody = await getResponse.json();

        expect(getResponse.status).toBe(200);
        expect(getBody.data.configured).toBe(true);
        expect(getBody.data.baseUrl).toBe("https://wa.example.com");
        expect(getBody.data.senderId).toBe("123456789");
        expect(getBody.data.apiKeyMasked).toBe("****7890");
    });

    it("returns configured false when no whatsapp key exists", async () => {
        const tenant = await createTenantOwner({
            tenantName: "Tenant Empty WhatsApp",
        });

        mockUser = {
            id: tenant.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.configured).toBe(false);
    });
});
