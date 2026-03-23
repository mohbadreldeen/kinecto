ALTER TABLE "message"
ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL,
ADD COLUMN "next_attempt_at" timestamp with time zone;