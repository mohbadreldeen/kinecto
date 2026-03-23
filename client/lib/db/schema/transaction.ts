import {
    index,
    integer,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";
import { customers } from "./customer";
import { tenants } from "./tenant";
import { users } from "./user";

export const transactionTypeEnum = pgEnum("transaction_type", [
    "credit",
    "debit",
]);

export const transactions = pgTable(
    "transaction",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        tenantId: uuid("tenant_id")
            .notNull()
            .references(() => tenants.id, { onDelete: "cascade" }),
        customerId: uuid("customer_id")
            .notNull()
            .references(() => customers.id, { onDelete: "cascade" }),
        performedBy: uuid("performed_by").references(() => users.id, {
            onDelete: "set null",
        }),
        type: transactionTypeEnum("type").notNull(),
        amount: integer("amount").notNull(),
        balanceAfter: integer("balance_after").notNull(),
        note: text("note"),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("transaction_tenant_id_idx").on(table.tenantId),
        index("transaction_customer_id_idx").on(table.customerId),
    ]
);
