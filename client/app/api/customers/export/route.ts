import {
    and,
    asc,
    desc,
    eq,
    gte,
    ilike,
    inArray,
    lte,
    or,
    sql,
} from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";

const exportQuerySchema = z
    .object({
        search: z.string().trim().optional(),
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

function parseSelectedIds(searchParams: URLSearchParams) {
    const selectedIds = searchParams.getAll("selectedIds").flatMap((value) =>
        value
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean)
    );

    const uniqueIds = [...new Set(selectedIds)];
    const parsedIds = z.array(z.string().uuid()).safeParse(uniqueIds);

    if (!parsedIds.success) {
        return {
            error: NextResponse.json(
                {
                    error: "Invalid selectedIds",
                    details: parsedIds.error.flatten(),
                },
                { status: 400 }
            ),
        };
    }

    return { value: parsedIds.data };
}

function toCsvValue(value: string | number | null) {
    if (value === null) return "";
    const stringValue = String(value);
    if (
        stringValue.includes(",") ||
        stringValue.includes("\n") ||
        stringValue.includes('"')
    ) {
        return `"${stringValue.replaceAll('"', '""')}"`;
    }
    return stringValue;
}

export async function GET(request: NextRequest) {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    if (tenantResult.context.role !== "owner") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const queryInput = {
        search: request.nextUrl.searchParams.get("search") ?? undefined,
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

    const parsedQuery = exportQuerySchema.safeParse(queryInput);
    if (!parsedQuery.success) {
        return NextResponse.json(
            {
                error: "Invalid query params",
                details: parsedQuery.error.flatten(),
            },
            { status: 400 }
        );
    }

    const parsedSelectedIds = parseSelectedIds(request.nextUrl.searchParams);
    if ("error" in parsedSelectedIds) {
        return parsedSelectedIds.error;
    }

    const {
        search,
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

    const selectedIds = parsedSelectedIds.value;

    const where = and(
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
        lastVisitTo ? lte(customers.lastVisitAt, lastVisitTo) : undefined,
        selectedIds.length > 0 ? inArray(customers.id, selectedIds) : undefined
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

    const rows = await db
        .select({
            id: customers.id,
            name: customers.name,
            phone: customers.phone,
            email: customers.email,
            pointsBalance: customers.pointsBalance,
            status: customers.status,
            tags: customers.tags,
            lastVisitAt: customers.lastVisitAt,
            createdAt: customers.createdAt,
        })
        .from(customers)
        .where(where)
        .orderBy(orderBy, desc(customers.id));

    const header = [
        "id",
        "name",
        "phone",
        "email",
        "pointsBalance",
        "status",
        "tags",
        "lastVisitAt",
        "createdAt",
    ];

    const dataLines = rows.map((row) =>
        [
            row.id,
            row.name,
            row.phone,
            row.email,
            row.pointsBalance,
            row.status,
            row.tags?.join("|") ?? "",
            row.lastVisitAt ? row.lastVisitAt.toISOString() : null,
            row.createdAt.toISOString(),
        ]
            .map((value) => toCsvValue(value))
            .join(",")
    );

    const csv = [header.join(","), ...dataLines].join("\n");
    const timestamp = new Date().toISOString().replaceAll(":", "-");
    const filename = `customers-export-${timestamp}.csv`;

    return new NextResponse(csv, {
        status: 200,
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename=\"${filename}\"`,
        },
    });
}
