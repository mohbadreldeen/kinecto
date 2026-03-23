import {
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenant";

export const segments = pgTable(
    "segment",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        tenantId: uuid("tenant_id")
            .notNull()
            .references(() => tenants.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        description: text("description"),
        filterCriteria: jsonb("filter_criteria")
            .$type<Record<string, unknown>>()
            .notNull(),
        customerCount: integer("customer_count").default(0).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [index("segment_tenant_id_idx").on(table.tenantId)]
);
