import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { tenants } from "./tenant";

export const employeeInvites = pgTable(
    "employee_invite",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        tenantId: uuid("tenant_id")
            .notNull()
            .references(() => tenants.id, { onDelete: "cascade" }),
        email: text("email").notNull(),
        fullName: text("full_name"),
        tokenHash: text("token_hash").notNull().unique(),
        invitedByAuthUserId: uuid("invited_by_auth_user_id").notNull(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        acceptedAt: timestamp("accepted_at", { withTimezone: true }),
        acceptedByAuthUserId: uuid("accepted_by_auth_user_id"),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("employee_invite_tenant_id_idx").on(table.tenantId),
        index("employee_invite_email_idx").on(table.email),
        index("employee_invite_expires_at_idx").on(table.expiresAt),
    ]
);
