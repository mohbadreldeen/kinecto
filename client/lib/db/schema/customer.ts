import {
    boolean,
    index,
    integer,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenant";

export const customerStatusEnum = pgEnum("customer_status", [
    "active",
    "inactive",
]);

export const customers = pgTable(
    "customer",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        tenantId: uuid("tenant_id")
            .notNull()
            .references(() => tenants.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        phone: text("phone").notNull(),
        email: text("email"),
        pointsBalance: integer("points_balance").default(0).notNull(),
        tags: text("tags").array().default([]),
        notes: text("notes"),
        qrCodeUrl: text("qr_code_url"),
        walletPassId: text("wallet_pass_id"),
        unsubscribed: boolean("unsubscribed").default(false).notNull(),
        status: customerStatusEnum("status").default("active").notNull(),
        lastVisitAt: timestamp("last_visit_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("customer_tenant_id_idx").on(table.tenantId),
        index("customer_phone_idx").on(table.phone),
        index("customer_name_idx").on(table.name),
    ]
);
