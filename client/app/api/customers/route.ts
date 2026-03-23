import {
    and,
    asc,
    count,
    desc,
    eq,
    gte,
    ilike,
    lte,
    or,
    sql,
} from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { createWalletPass } from "@/lib/integrations/passkit";

const listQuerySchema = z
    .object({
        search: z.string().trim().optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        status: z.enum(["active", "inactive"]).optional(),
        tag: z.string().trim().min(1).max(40).optional(),
        minPoints: z.coerce.number().int().min(0).optional(),
        maxPoints: z.coerce.number().int().min(0).optional(),
        registeredFrom: z.coerce.date().optional(),
        registeredTo: z.coerce.date().optional(),
        lastVisitFrom: z.coerce.date().optional(),
        lastVisitTo: z.coerce.date().optional(),
        sortBy: z
            .enum(["registration", "name", "points", "lastActivity"])
            .default("registration"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
    })
    .refine(
        (value) =>
            value.minPoints === undefined ||
            value.maxPoints === undefined ||
            value.minPoints <= value.maxPoints,
        {
            message: "minPoints must be lower than or equal to maxPoints",
            path: ["minPoints"],
        }
    )
    .refine(
        (value) =>
            value.registeredFrom === undefined ||
            value.registeredTo === undefined ||
            value.registeredFrom <= value.registeredTo,
        {
            message: "registeredFrom must be before or equal to registeredTo",
            path: ["registeredFrom"],
        }
    )
    .refine(
        (value) =>
            value.lastVisitFrom === undefined ||
            value.lastVisitTo === undefined ||
            value.lastVisitFrom <= value.lastVisitTo,
        {
            message: "lastVisitFrom must be before or equal to lastVisitTo",
            path: ["lastVisitFrom"],
        }
    );

const createCustomerSchema = z.object({
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(6).max(30),
    email: z.email().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    notes: z.string().trim().max(1000).optional(),
});

function buildCustomerQrCodeUrl(request: NextRequest, customerId: string) {
    const configuredBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    const baseUrl = configuredBaseUrl?.length
        ? configuredBaseUrl
        : request.nextUrl.origin;

    return `${baseUrl.replace(/\/$/, "")}/c/${customerId}`;
}

function normalizePhone(phone: string) {
    return phone.trim();
}

async function tenantHasCustomerPhone(params: {
    tenantId: string;
    phone: string;
}) {
    const existing = await db.query.customers.findFirst({
        where: and(
            eq(customers.tenantId, params.tenantId),
            eq(customers.phone, params.phone)
        ),
        columns: { id: true },
    });

    return Boolean(existing);
}

export async function GET(request: NextRequest) {
    const tenantResult = await requireTenantContext();
    if ("response" in tenantResult) {
        return tenantResult.response;
    }

    const queryInput = {
        search: request.nextUrl.searchParams.get("search") ?? undefined,
        page: request.nextUrl.searchParams.get("page") ?? undefined,
        pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
        status: request.nextUrl.searchParams.get("status") ?? undefined,
        tag: request.nextUrl.searchParams.get("tag") ?? undefined,
        minPoints: request.nextUrl.searchParams.get("minPoints") ?? undefined,
        maxPoints: request.nextUrl.searchParams.get("maxPoints") ?? undefined,
        registeredFrom:
            request.nextUrl.searchParams.get("registeredFrom") ?? undefined,
        registeredTo:
            request.nextUrl.searchParams.get("registeredTo") ?? undefined,
        lastVisitFrom:
            request.nextUrl.searchParams.get("lastVisitFrom") ?? undefined,
        lastVisitTo:
            request.nextUrl.searchParams.get("lastVisitTo") ?? undefined,
        sortBy: request.nextUrl.searchParams.get("sortBy") ?? undefined,
        sortOrder: request.nextUrl.searchParams.get("sortOrder") ?? undefined,
    };

    const parsedQuery = listQuerySchema.safeParse(queryInput);
    if (!parsedQuery.success) {
        return NextResponse.json(
            {
                error: "Invalid query params",
                details: parsedQuery.error.flatten(),
            },
            { status: 400 }
        );
    }

    const {
        search,
        page,
        pageSize,
        status,
        tag,
        minPoints,
        maxPoints,
        registeredFrom,
        registeredTo,
        lastVisitFrom,
        lastVisitTo,
        sortBy,
        sortOrder,
    } = parsedQuery.data;
    const offset = (page - 1) * pageSize;

    const baseWhere = and(
        eq(customers.tenantId, tenantResult.context.tenantId),
        search
            ? or(
                  ilike(customers.name, `%${search}%`),
                  ilike(customers.phone, `%${search}%`)
              )
            : undefined,
        status ? eq(customers.status, status) : undefined,
        tag ? sql`${tag} = ANY(${customers.tags})` : undefined,
        minPoints !== undefined
            ? gte(customers.pointsBalance, minPoints)
            : undefined,
        maxPoints !== undefined
            ? lte(customers.pointsBalance, maxPoints)
            : undefined,
        registeredFrom ? gte(customers.createdAt, registeredFrom) : undefined,
        registeredTo ? lte(customers.createdAt, registeredTo) : undefined,
        lastVisitFrom ? gte(customers.lastVisitAt, lastVisitFrom) : undefined,
        lastVisitTo ? lte(customers.lastVisitAt, lastVisitTo) : undefined
    );

    const sortDirection = sortOrder === "asc" ? asc : desc;
    const orderBy =
        sortBy === "name"
            ? sortDirection(customers.name)
            : sortBy === "points"
              ? sortDirection(customers.pointsBalance)
              : sortBy === "lastActivity"
                ? sortDirection(customers.lastVisitAt)
                : sortDirection(customers.createdAt);

    const [rows, totalResult] = await Promise.all([
        db
            .select({
                id: customers.id,
                name: customers.name,
                phone: customers.phone,
                email: customers.email,
                pointsBalance: customers.pointsBalance,
                tags: customers.tags,
                status: customers.status,
                walletPassId: customers.walletPassId,
                lastVisitAt: customers.lastVisitAt,
                createdAt: customers.createdAt,
                updatedAt: customers.updatedAt,
            })
            .from(customers)
            .where(baseWhere)
            .orderBy(orderBy, desc(customers.id))
            .limit(pageSize)
            .offset(offset),
        db.select({ value: count() }).from(customers).where(baseWhere),
    ]);

    const total = Number(totalResult[0]?.value ?? 0);

    return NextResponse.json({
        data: rows,
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
    });
}

export async function POST(request: NextRequest) {
    const tenantResult = await requireTenantContext();
    if ("response" in tenantResult) {
        return tenantResult.response;
    }

    const json = await request.json().catch(() => null);
    const parsedBody = createCustomerSchema.safeParse(json);

    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: "Invalid request body",
                details: parsedBody.error.flatten(),
            },
            { status: 400 }
        );
    }

    const payload = parsedBody.data;
    const normalizedPhone = normalizePhone(payload.phone);

    const hasDuplicatePhone = await tenantHasCustomerPhone({
        tenantId: tenantResult.context.tenantId,
        phone: normalizedPhone,
    });

    if (hasDuplicatePhone) {
        return NextResponse.json(
            {
                error: "A customer with this phone number already exists",
            },
            { status: 409 }
        );
    }

    const [created] = await db
        .insert(customers)
        .values({
            tenantId: tenantResult.context.tenantId,
            name: payload.name,
            phone: normalizedPhone,
            email: payload.email,
            tags: payload.tags ?? [],
            notes: payload.notes,
        })
        .returning({
            id: customers.id,
            name: customers.name,
            phone: customers.phone,
            email: customers.email,
            pointsBalance: customers.pointsBalance,
            qrCodeUrl: customers.qrCodeUrl,
            status: customers.status,
            createdAt: customers.createdAt,
        });

    const qrCodeUrl = buildCustomerQrCodeUrl(request, created.id);

    await db
        .update(customers)
        .set({
            qrCodeUrl,
            updatedAt: new Date(),
        })
        .where(eq(customers.id, created.id));

    let walletPassId: string | null = null;
    let walletPassUrl: string | null = null;

    try {
        const pass = await createWalletPass({
            tenantId: tenantResult.context.tenantId,
            customerId: created.id,
            customerName: created.name,
            phone: created.phone,
            pointsBalance: created.pointsBalance,
            qrCodeUrl,
            memberSinceIso: created.createdAt.toISOString(),
            tenantName: tenantResult.context.tenantId,
        });

        if (pass) {
            walletPassId = pass.walletPassId;
            walletPassUrl = pass.downloadUrl;

            await db
                .update(customers)
                .set({
                    walletPassId: pass.walletPassId,
                    updatedAt: new Date(),
                })
                .where(eq(customers.id, created.id));
        }
    } catch {
        walletPassId = null;
        walletPassUrl = null;
    }

    return NextResponse.json(
        {
            data: {
                ...created,
                qrCodeUrl,
                walletPassId,
                walletPassUrl,
            },
        },
        { status: 201 }
    );
}
