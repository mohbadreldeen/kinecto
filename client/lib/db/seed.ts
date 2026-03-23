import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";

import { createAdminClient } from "@/lib/supabase/admin";

import { db, pool } from "./index";
import { customers, tenants, transactions, users } from "./schema";

const OWNER_EMAIL = "test@test.com";
const OWNER_PASSWORD = "TestPass123!";

const EMPLOYEE_SEEDS = [
    {
        email: "employee.one@test.com",
        password: "TestPass123!",
        fullName: "Employee One",
    },
    {
        email: "employee.two@test.com",
        password: "TestPass123!",
        fullName: "Employee Two",
    },
] as const;

const CUSTOMER_SEEDS = [
    {
        name: "Layla Hassan",
        phone: "+201000000001",
        tags: ["vip"],
        notes: "Seeded customer",
    },
    {
        name: "Omar Khaled",
        phone: "+201000000002",
        tags: ["new"],
        notes: "Seeded customer",
    },
    {
        name: "Mina Adel",
        phone: "+201000000003",
        tags: ["regular"],
        notes: "Seeded customer",
    },
] as const;

async function upsertAuthUser(input: {
    email: string;
    password: string;
    tenantId: string;
    role: "owner" | "employee";
    fullName: string;
}) {
    const admin = createAdminClient();

    const { data: existingList, error: listError } =
        await admin.auth.admin.listUsers({
            page: 1,
            perPage: 1000,
        });

    if (listError) {
        throw listError;
    }

    const existing = existingList.users.find(
        (user) => user.email?.toLowerCase() === input.email.toLowerCase()
    );

    if (existing) {
        const { error: updateError } = await admin.auth.admin.updateUserById(
            existing.id,
            {
                password: input.password,
                email_confirm: true,
                user_metadata: { fullName: input.fullName },
                app_metadata: {
                    tenantId: input.tenantId,
                    role: input.role,
                },
            }
        );

        if (updateError) {
            throw updateError;
        }

        return existing.id;
    }

    const { data, error } = await admin.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: { fullName: input.fullName },
        app_metadata: {
            tenantId: input.tenantId,
            role: input.role,
        },
    });

    if (error || !data.user) {
        throw error ?? new Error(`Could not create auth user: ${input.email}`);
    }

    return data.user.id;
}

async function upsertMembership(input: {
    tenantId: string;
    authUserId: string;
    email: string;
    fullName: string;
    role: "owner" | "employee";
}) {
    const existing = await db.query.users.findFirst({
        where: eq(users.authUserId, input.authUserId),
    });

    if (existing) {
        await db
            .update(users)
            .set({
                tenantId: input.tenantId,
                email: input.email,
                fullName: input.fullName,
                role: input.role,
                status: "active",
                updatedAt: new Date(),
            })
            .where(eq(users.id, existing.id));

        return existing.id;
    }

    const [created] = await db
        .insert(users)
        .values({
            tenantId: input.tenantId,
            authUserId: input.authUserId,
            email: input.email,
            fullName: input.fullName,
            role: input.role,
            status: "active",
        })
        .returning({ id: users.id });

    return created.id;
}

async function upsertCustomer(input: {
    tenantId: string;
    name: string;
    phone: string;
    tags: readonly string[];
    notes: string;
}) {
    const existing = await db.query.customers.findFirst({
        where: and(
            eq(customers.tenantId, input.tenantId),
            eq(customers.phone, input.phone)
        ),
    });

    if (existing) {
        await db
            .update(customers)
            .set({
                name: input.name,
                tags: [...input.tags],
                notes: input.notes,
                status: "active",
                updatedAt: new Date(),
            })
            .where(eq(customers.id, existing.id));

        return existing.id;
    }

    const [created] = await db
        .insert(customers)
        .values({
            tenantId: input.tenantId,
            name: input.name,
            phone: input.phone,
            tags: [...input.tags],
            notes: input.notes,
            status: "active",
        })
        .returning({ id: customers.id });

    return created.id;
}

async function seed() {
    const [tenant] = await db
        .insert(tenants)
        .values({
            name: "Demo Cafe",
            slug: "demo-cafe",
            settings: { locale: "en" },
            brandColors: { primary: "#0f172a", accent: "#22c55e" },
        })
        .onConflictDoNothing({ target: tenants.slug })
        .returning();

    const existingTenant = tenant
        ? tenant
        : await db.query.tenants.findFirst({
              where: eq(tenants.slug, "demo-cafe"),
          });

    if (!existingTenant) {
        throw new Error("Could not create or load tenant seed record");
    }

    const ownerAuthUserId = await upsertAuthUser({
        email: OWNER_EMAIL,
        password: OWNER_PASSWORD,
        tenantId: existingTenant.id,
        role: "owner",
        fullName: "Test Owner",
    });

    await upsertMembership({
        tenantId: existingTenant.id,
        authUserId: ownerAuthUserId,
        email: OWNER_EMAIL,
        fullName: "Test Owner",
        role: "owner",
    });

    const employeeMembershipIds: string[] = [];
    for (const employee of EMPLOYEE_SEEDS) {
        const authUserId = await upsertAuthUser({
            email: employee.email,
            password: employee.password,
            tenantId: existingTenant.id,
            role: "employee",
            fullName: employee.fullName,
        });

        const membershipId = await upsertMembership({
            tenantId: existingTenant.id,
            authUserId,
            email: employee.email,
            fullName: employee.fullName,
            role: "employee",
        });

        employeeMembershipIds.push(membershipId);
    }

    const seededCustomerIds: string[] = [];
    for (const customerSeed of CUSTOMER_SEEDS) {
        const customerId = await upsertCustomer({
            tenantId: existingTenant.id,
            name: customerSeed.name,
            phone: customerSeed.phone,
            tags: customerSeed.tags,
            notes: customerSeed.notes,
        });
        seededCustomerIds.push(customerId);
    }

    if (seededCustomerIds.length > 0) {
        await db
            .delete(transactions)
            .where(inArray(transactions.customerId, seededCustomerIds));
    }

    const now = Date.now();
    const transactionSeeds = [
        {
            customerIndex: 0,
            type: "credit" as const,
            amount: 100,
            balanceAfter: 100,
            note: "seed: signup bonus",
            minutesAgo: 120,
        },
        {
            customerIndex: 0,
            type: "debit" as const,
            amount: 20,
            balanceAfter: 80,
            note: "seed: redeem coffee",
            minutesAgo: 90,
        },
        {
            customerIndex: 1,
            type: "credit" as const,
            amount: 45,
            balanceAfter: 45,
            note: "seed: first purchase",
            minutesAgo: 60,
        },
        {
            customerIndex: 2,
            type: "credit" as const,
            amount: 30,
            balanceAfter: 30,
            note: "seed: promo credit",
            minutesAgo: 30,
        },
        {
            customerIndex: 2,
            type: "debit" as const,
            amount: 5,
            balanceAfter: 25,
            note: "seed: snack redeem",
            minutesAgo: 10,
        },
    ];

    await db.insert(transactions).values(
        transactionSeeds.map((seedRow, index) => ({
            tenantId: existingTenant.id,
            customerId: seededCustomerIds[seedRow.customerIndex],
            performedBy:
                employeeMembershipIds[index % employeeMembershipIds.length] ??
                null,
            type: seedRow.type,
            amount: seedRow.amount,
            balanceAfter: seedRow.balanceAfter,
            note: seedRow.note,
            createdAt: new Date(now - seedRow.minutesAgo * 60_000),
        }))
    );

    await db
        .update(customers)
        .set({
            pointsBalance: 80,
            lastVisitAt: new Date(now - 90 * 60_000),
            updatedAt: new Date(),
        })
        .where(eq(customers.id, seededCustomerIds[0]));

    await db
        .update(customers)
        .set({
            pointsBalance: 45,
            lastVisitAt: new Date(now - 60 * 60_000),
            updatedAt: new Date(),
        })
        .where(eq(customers.id, seededCustomerIds[1]));

    await db
        .update(customers)
        .set({
            pointsBalance: 25,
            lastVisitAt: new Date(now - 10 * 60_000),
            updatedAt: new Date(),
        })
        .where(eq(customers.id, seededCustomerIds[2]));

    console.log("Seed completed for test@test.com");
    console.log(`Owner: ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);
    console.log(
        `Employees: ${EMPLOYEE_SEEDS.map((employee) => employee.email).join(", ")}`
    );
}

seed()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
