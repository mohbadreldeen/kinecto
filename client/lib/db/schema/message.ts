import {
    index,
    integer,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";
import { campaigns } from "./campaign";
import { customers } from "./customer";
import { tenants } from "./tenant";

export const messageStatusEnum = pgEnum("message_status", [
    "queued",
    "sent",
    "delivered",
    "read",
    "failed",
]);

export const messages = pgTable(
    "message",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        tenantId: uuid("tenant_id")
            .notNull()
            .references(() => tenants.id, { onDelete: "cascade" }),
        campaignId: uuid("campaign_id")
            .notNull()
            .references(() => campaigns.id, { onDelete: "cascade" }),
        customerId: uuid("customer_id")
            .notNull()
            .references(() => customers.id, { onDelete: "cascade" }),
        channel: text("channel").notNull(),
        content: text("content").notNull(),
        externalId: text("external_id"),
        status: messageStatusEnum("status").default("queued").notNull(),
        attemptCount: integer("attempt_count").default(0).notNull(),
        nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }),
        errorMessage: text("error_message"),
        sentAt: timestamp("sent_at", { withTimezone: true }),
        deliveredAt: timestamp("delivered_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("message_tenant_id_idx").on(table.tenantId),
        index("message_campaign_id_idx").on(table.campaignId),
    ]
);
