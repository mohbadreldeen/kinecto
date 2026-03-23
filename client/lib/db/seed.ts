import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";

import { createAdminClient } from "@/lib/supabase/admin";

import { db, pool } from "./index";
import { customers, tenants, transactions, users } from "./schema";

const DEFAULT_PASSWORD = "TestPass123!";

type EmployeeSeed = {
    email: string;
    fullName: string;
    password?: string;
};

type CustomerSeed = {
    name: string;
    phone: string;
    tags: readonly string[];
    notes: string;
};

type TenantSeed = {
    name: string;
    slug: string;
    settings: Record<string, string>;
    brandColors: {
        primary: string;
        accent: string;
    };
    owner: {
        email: string;
        fullName: string;
        password?: string;
    };
    employees: readonly EmployeeSeed[];
    customers: readonly CustomerSeed[];
};

const TENANT_SEEDS: readonly TenantSeed[] = [
    {
        name: "Demo Cafe",
        slug: "demo-cafe",
        settings: { locale: "en" },
        brandColors: { primary: "#0f172a", accent: "#22c55e" },
        owner: {
            email: "test@test.com",
            fullName: "Test Owner",
            password: DEFAULT_PASSWORD,
        },
        employees: [
            {
                email: "employee.one@test.com",
                fullName: "Employee One",
            },
            {
                email: "employee.two@test.com",
                fullName: "Employee Two",
            },
            {
                email: "employee.three@test.com",
                fullName: "Employee Three",
            },
        ],
        customers: [
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
            {
                name: "Nour Samir",
                phone: "+201000000004",
                tags: ["vip", "loyal"],
                notes: "Frequent morning customer",
            },
            {
                name: "Youssef Tarek",
                phone: "+201000000005",
                tags: ["new"],
                notes: "Joined from social campaign",
            },
            {
                name: "Sara Nabil",
                phone: "+201000000006",
                tags: ["regular"],
                notes: "Prefers weekend offers",
            },
        ],
    },
    {
        name: "Demo Bakery",
        slug: "demo-bakery",
        settings: { locale: "en" },
        brandColors: { primary: "#7c2d12", accent: "#f59e0b" },
        owner: {
            email: "owner.bakery@test.com",
            fullName: "Bakery Owner",
            password: DEFAULT_PASSWORD,
        },
        employees: [
            {
                email: "bakery.employee.one@test.com",
                fullName: "Baker One",
            },
            {
                email: "bakery.employee.two@test.com",
                fullName: "Baker Two",
            },
        ],
        customers: [
            {
                name: "Amina Farouk",
                phone: "+201000000011",
                tags: ["vip"],
                notes: "Buys family packs",
            },
            {
                name: "Karim Mostafa",
                phone: "+201000000012",
                tags: ["regular"],
                notes: "Weekly bread order",
            },
            {
                name: "Hana Magdy",
                phone: "+201000000013",
                tags: ["new"],
                notes: "First month subscriber",
            },
            {
                name: "Salma Hany",
                phone: "+201000000014",
                tags: ["regular", "loyal"],
                notes: "Responds to promo messages",
            },
        ],
    },
];

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
    const now = Date.now();

    for (const tenantSeed of TENANT_SEEDS) {
        const [insertedTenant] = await db
            .insert(tenants)
            .values({
                name: tenantSeed.name,
                slug: tenantSeed.slug,
                settings: tenantSeed.settings,
                brandColors: tenantSeed.brandColors,
            })
            .onConflictDoNothing({ target: tenants.slug })
            .returning();

        const existingTenant = insertedTenant
            ? insertedTenant
            : await db.query.tenants.findFirst({
                  where: eq(tenants.slug, tenantSeed.slug),
              });

        if (!existingTenant) {
            throw new Error(
                `Could not create or load tenant seed record: ${tenantSeed.slug}`
            );
        }

        const ownerPassword = tenantSeed.owner.password ?? DEFAULT_PASSWORD;
        const ownerAuthUserId = await upsertAuthUser({
            email: tenantSeed.owner.email,
            password: ownerPassword,
            tenantId: existingTenant.id,
            role: "owner",
            fullName: tenantSeed.owner.fullName,
        });

        await upsertMembership({
            tenantId: existingTenant.id,
            authUserId: ownerAuthUserId,
            email: tenantSeed.owner.email,
            fullName: tenantSeed.owner.fullName,
            role: "owner",
        });

        const employeeMembershipIds: string[] = [];
        for (const employee of tenantSeed.employees) {
            const authUserId = await upsertAuthUser({
                email: employee.email,
                password: employee.password ?? DEFAULT_PASSWORD,
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
        for (const customerSeed of tenantSeed.customers) {
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
                note: "seed: redeem reward",
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
                    employeeMembershipIds[
                        index % Math.max(employeeMembershipIds.length, 1)
                    ] ?? null,
                type: seedRow.type,
                amount: seedRow.amount,
                balanceAfter: seedRow.balanceAfter,
                note: seedRow.note,
                createdAt: new Date(now - seedRow.minutesAgo * 60_000),
            }))
        );

        const balancePattern = [80, 45, 25, 60, 35, 20];
        for (let i = 0; i < seededCustomerIds.length; i += 1) {
            const points = balancePattern[i % balancePattern.length];
            await db
                .update(customers)
                .set({
                    pointsBalance: points,
                    lastVisitAt: new Date(now - (10 + i * 15) * 60_000),
                    updatedAt: new Date(),
                })
                .where(eq(customers.id, seededCustomerIds[i]));
        }

        console.log(`Seed completed for tenant: ${tenantSeed.name}`);
        console.log(`Owner: ${tenantSeed.owner.email} / ${ownerPassword}`);
        console.log(
            `Employees: ${tenantSeed.employees
                .map((employee) => employee.email)
                .join(", ")}`
        );
        console.log(`Customers: ${tenantSeed.customers.length}`);
    }
}

seed()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
