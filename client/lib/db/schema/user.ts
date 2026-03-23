import {
    index,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenant";

export const userRoleEnum = pgEnum("user_role", ["owner", "employee"]);
export const userStatusEnum = pgEnum("user_status", ["active", "inactive"]);

export const users = pgTable(
    "user",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        tenantId: uuid("tenant_id")
            .notNull()
            .references(() => tenants.id, { onDelete: "cascade" }),
        authUserId: uuid("auth_user_id").notNull().unique(),
        email: text("email").notNull(),
        fullName: text("full_name"),
        role: userRoleEnum("role").default("employee").notNull(),
        status: userStatusEnum("status").default("active").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("user_tenant_id_idx").on(table.tenantId),
        index("user_email_idx").on(table.email),
        index("user_auth_user_id_idx").on(table.authUserId),
    ]
);
