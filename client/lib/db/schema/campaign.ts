import {
    index,
    jsonb,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenant";

export const campaignChannelEnum = pgEnum("campaign_channel", [
    "whatsapp",
    "email",
]);
export const campaignStatusEnum = pgEnum("campaign_status", [
    "draft",
    "scheduled",
    "sending",
    "sent",
    "failed",
]);

export const campaigns = pgTable(
    "campaign",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        tenantId: uuid("tenant_id")
            .notNull()
            .references(() => tenants.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        channel: campaignChannelEnum("channel").notNull(),
        templateBody: text("template_body").notNull(),
        audienceType: text("audience_type").notNull(),
        audienceCriteria: jsonb("audience_criteria")
            .$type<Record<string, unknown>>()
            .default({}),
        status: campaignStatusEnum("status").default("draft").notNull(),
        stats: jsonb("stats")
            .$type<{
                queued: number;
                sent: number;
                delivered: number;
                failed: number;
            }>()
            .default({ queued: 0, sent: 0, delivered: 0, failed: 0 }),
        lastQueueRun: jsonb("last_queue_run").$type<{
            runAt: string;
            processed: number;
            sent: number;
            failed: number;
            deferred: number;
            rateLimited: boolean;
            retryAfterSeconds: number | null;
        } | null>(),
        scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
        sentAt: timestamp("sent_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index("campaign_tenant_id_idx").on(table.tenantId),
        index("campaign_status_idx").on(table.status),
    ]
);
