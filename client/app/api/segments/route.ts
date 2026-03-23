import { and, asc, count, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireTenantContext } from "@/lib/api/tenant-context";
import { db } from "@/lib/db";
import { customers, segments } from "@/lib/db/schema";

const segmentFilterSchema = z
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
            .optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
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

const createSegmentSchema = z.object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(400).optional(),
    filterCriteria: segmentFilterSchema,
});

function buildCustomerWhereForSegment(params: {
    tenantId: string;
    filter: z.infer<typeof segmentFilterSchema>;
}) {
    const filter = params.filter;

    return and(
        eq(customers.tenantId, params.tenantId),
        filter.search
            ? or(
                  ilike(customers.name, `%${filter.search}%`),
                  ilike(customers.phone, `%${filter.search}%`)
              )
            : undefined,
        filter.status ? eq(customers.status, filter.status) : undefined,
        filter.tag ? sql`${filter.tag} = ANY(${customers.tags})` : undefined,
        filter.minPoints !== undefined
            ? gte(customers.pointsBalance, filter.minPoints)
            : undefined,
        filter.maxPoints !== undefined
            ? lte(customers.pointsBalance, filter.maxPoints)
            : undefined,
        filter.registeredFrom
            ? gte(customers.createdAt, filter.registeredFrom)
            : undefined,
        filter.registeredTo
            ? lte(customers.createdAt, filter.registeredTo)
            : undefined,
        filter.lastVisitFrom
            ? gte(customers.lastVisitAt, filter.lastVisitFrom)
            : undefined,
        filter.lastVisitTo
            ? lte(customers.lastVisitAt, filter.lastVisitTo)
            : undefined
    );
}

export async function GET() {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    if (tenantResult.context.role !== "owner") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rows = await db
        .select({
            id: segments.id,
            name: segments.name,
            description: segments.description,
            filterCriteria: segments.filterCriteria,
            customerCount: segments.customerCount,
            createdAt: segments.createdAt,
            updatedAt: segments.updatedAt,
        })
        .from(segments)
        .where(eq(segments.tenantId, tenantResult.context.tenantId))
        .orderBy(asc(segments.createdAt));

    return NextResponse.json({ data: rows });
}

export async function POST(request: NextRequest) {
    const tenantResult = await requireTenantContext();
    if (!("context" in tenantResult)) {
        return tenantResult.response;
    }

    if (tenantResult.context.role !== "owner") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    const parsedBody = createSegmentSchema.safeParse(body);
    if (!parsedBody.success) {
        return NextResponse.json(
            {
                error: "Invalid payload",
                details: parsedBody.error.flatten(),
            },
            { status: 400 }
        );
    }

    const where = buildCustomerWhereForSegment({
        tenantId: tenantResult.context.tenantId,
        filter: parsedBody.data.filterCriteria,
    });

    const [customerCountResult] = await db
        .select({ value: count() })
        .from(customers)
        .where(where);

    const [created] = await db
        .insert(segments)
        .values({
            tenantId: tenantResult.context.tenantId,
            name: parsedBody.data.name,
            description: parsedBody.data.description,
            filterCriteria: parsedBody.data.filterCriteria,
            customerCount: Number(customerCountResult?.value ?? 0),
        })
        .returning({
            id: segments.id,
            name: segments.name,
            description: segments.description,
            filterCriteria: segments.filterCriteria,
            customerCount: segments.customerCount,
            createdAt: segments.createdAt,
            updatedAt: segments.updatedAt,
        });

    return NextResponse.json({ data: created }, { status: 201 });
}
