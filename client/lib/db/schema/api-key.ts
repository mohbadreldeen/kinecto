import {
    index,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenant";

export const apiServiceEnum = pgEnum("api_service", [
    "whatsapp",
    "passkit",
    "email",
]);

export const apiKeys = pgTable(
    "api_key",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        tenantId: uuid("tenant_id")
            .notNull()
            .references(() => tenants.id, { onDelete: "cascade" }),
        service: apiServiceEnum("service").notNull(),
        encryptedKey: text("encrypted_key").notNull(),
        label: text("label"),
        isActive: text("is_active").default("true").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("api_key_tenant_id_idx").on(table.tenantId),
        index("api_key_service_idx").on(table.service),
    ]
);
