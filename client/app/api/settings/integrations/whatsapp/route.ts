import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/security/secrets";

const whatsappSettingsSchema = z.object({
    baseUrl: z.string().url().max(500),
    apiKey: z.string().trim().min(8).max(1000),
    senderId: z.string().trim().min(2).max(80),
    label: z.string().trim().max(120).optional(),
});

type StoredWhatsAppCredentials = {
    baseUrl: string;
    apiKey: string;
    senderId: string;
};

function parseStoredWhatsAppCredentials(rawValue: string) {
    const decrypted = decryptSecret(rawValue);
    const parsed = z
        .object({
            baseUrl: z.string().url(),
            apiKey: z.string().min(1),
            senderId: z.string().min(1),
        })
        .safeParse(JSON.parse(decrypted) as unknown);

    if (!parsed.success) {
        throw new Error("Stored WhatsApp credentials are invalid");
    }

    return parsed.data;
}

export async function GET() {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    if (tenantResult.context.role !== "owner") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const row = await db.query.apiKeys.findFirst({
        where: and(
            eq(apiKeys.tenantId, tenantResult.context.tenantId),
            eq(apiKeys.service, "whatsapp"),
            eq(apiKeys.isActive, "true")
        ),
    });

    if (!row) {
        return NextResponse.json({
            data: {
                configured: false,
                label: null,
                baseUrl: "",
                senderId: "",
                apiKeyMasked: "",
            },
        });
    }

    const credentials = parseStoredWhatsAppCredentials(row.encryptedKey);

    return NextResponse.json({
        data: {
            configured: true,
            label: row.label ?? null,
            baseUrl: credentials.baseUrl,
            senderId: credentials.senderId,
            apiKeyMasked: `****${credentials.apiKey.slice(-4)}`,
            updatedAt: row.updatedAt,
        },
    });
}

export async function PUT(request: NextRequest) {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    if (tenantResult.context.role !== "owner") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsedBody = whatsappSettingsSchema.safeParse(body);
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
    const stored: StoredWhatsAppCredentials = {
        baseUrl: payload.baseUrl,
        apiKey: payload.apiKey,
        senderId: payload.senderId,
    };

    const encryptedKey = encryptSecret(JSON.stringify(stored));

    const existing = await db.query.apiKeys.findFirst({
        where: and(
            eq(apiKeys.tenantId, tenantResult.context.tenantId),
            eq(apiKeys.service, "whatsapp")
        ),
        columns: { id: true },
    });

    if (existing) {
        await db
            .update(apiKeys)
            .set({
                encryptedKey,
                label: payload.label ?? null,
                isActive: "true",
                updatedAt: new Date(),
            })
            .where(eq(apiKeys.id, existing.id));
    } else {
        await db.insert(apiKeys).values({
            tenantId: tenantResult.context.tenantId,
            service: "whatsapp",
            encryptedKey,
            label: payload.label ?? null,
            isActive: "true",
        });
    }

    return NextResponse.json({ data: { saved: true } });
}
