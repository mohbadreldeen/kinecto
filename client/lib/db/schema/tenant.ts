import {
    index,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";

export const tenantStatusEnum = pgEnum("tenant_status", [
    "active",
    "suspended",
    "deleted",
]);

export const tenants = pgTable(
    "tenant",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        name: text("name").notNull(),
        slug: text("slug").notNull().unique(),
        logoUrl: text("logo_url"),
        settings: jsonb("settings")
            .$type<Record<string, unknown>>()
            .default({}),
        brandColors: jsonb("brand_colors")
            .$type<Record<string, string>>()
            .default({}),
        status: tenantStatusEnum("status").default("active").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [index("tenant_slug_idx").on(table.slug)]
);
