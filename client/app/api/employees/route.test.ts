import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { tenants, users } from "@/lib/db/schema";

let mockUser: {
    id: string;
    app_metadata?: { tenantId?: string };
} | null = null;

const deleteUserMock = vi.fn(async () => ({ data: {}, error: null }));

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

vi.mock("@/lib/supabase/admin", () => ({
    createAdminClient: () => ({
        auth: {
            admin: {
                deleteUser: deleteUserMock,
            },
        },
    }),
}));

import { GET } from "./route";
import { DELETE, PATCH } from "./[id]/route";

const createdTenantIds = new Set<string>();

async function createTenantWithUsers() {
    const ownerAuthUserId = randomUUID();
    const employeeAuthUserId = randomUUID();
    const slug = `employees-${randomUUID().slice(0, 8)}`;

    const [tenant] = await db
        .insert(tenants)
        .values({
            name: `Tenant ${slug}`,
            slug,
            settings: {},
            brandColors: {},
        })
        .returning({ id: tenants.id });

    createdTenantIds.add(tenant.id);

    const [owner] = await db
        .insert(users)
        .values({
            tenantId: tenant.id,
            authUserId: ownerAuthUserId,
            email: `${slug}-owner@example.test`,
            fullName: "Owner User",
            role: "owner",
            status: "active",
        })
        .returning({ id: users.id, authUserId: users.authUserId });

    const [employee] = await db
        .insert(users)
        .values({
            tenantId: tenant.id,
            authUserId: employeeAuthUserId,
            email: `${slug}-employee@example.test`,
            fullName: "Employee User",
            role: "employee",
            status: "active",
        })
        .returning({ id: users.id, authUserId: users.authUserId });

    return {
        tenantId: tenant.id,
        owner,
        employee,
    };
}

beforeEach(() => {
    mockUser = null;
    deleteUserMock.mockClear();
});

afterEach(async () => {
    if (createdTenantIds.size === 0) return;

    for (const tenantId of createdTenantIds) {
        await db.delete(users).where(eq(users.tenantId, tenantId));
        await db.delete(tenants).where(eq(tenants.id, tenantId));
    }

    createdTenantIds.clear();
});

describe("/api/employees", () => {
    it("lists only employees for the current owner tenant", async () => {
        const tenantA = await createTenantWithUsers();
        await createTenantWithUsers();

        mockUser = {
            id: tenantA.owner.authUserId,
            app_metadata: { tenantId: tenantA.tenantId },
        };

        const request = new NextRequest("http://localhost:3000/api/employees", {
            method: "GET",
        });

        const response = await GET();
        const body = await response.json();

        expect(request.method).toBe("GET");
        expect(response.status).toBe(200);
        expect(body.data).toHaveLength(1);
        expect(body.data[0].email).toContain("employee@example.test");
    });

    it("disables an employee", async () => {
        const tenant = await createTenantWithUsers();

        mockUser = {
            id: tenant.owner.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest(
            `http://localhost:3000/api/employees/${tenant.employee.id}`,
            {
                method: "PATCH",
                body: JSON.stringify({ status: "inactive" }),
                headers: {
                    "content-type": "application/json",
                },
            }
        );

        const response = await PATCH(request, {
            params: Promise.resolve({ id: tenant.employee.id }),
        });
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.status).toBe("inactive");

        const disabledEmployee = await db.query.users.findFirst({
            where: eq(users.id, tenant.employee.id),
        });

        expect(disabledEmployee?.status).toBe("inactive");
    });

    it("deletes an employee and revokes auth access", async () => {
        const tenant = await createTenantWithUsers();

        mockUser = {
            id: tenant.owner.authUserId,
            app_metadata: { tenantId: tenant.tenantId },
        };

        const request = new NextRequest(
            `http://localhost:3000/api/employees/${tenant.employee.id}`,
            {
                method: "DELETE",
            }
        );

        const response = await DELETE(request, {
            params: Promise.resolve({ id: tenant.employee.id }),
        });

        expect(response.status).toBe(204);

        const deletedEmployee = await db.query.users.findFirst({
            where: eq(users.id, tenant.employee.id),
        });

        expect(deletedEmployee).toBeUndefined();
        expect(deleteUserMock).toHaveBeenCalledWith(tenant.employee.authUserId);
    });
});
