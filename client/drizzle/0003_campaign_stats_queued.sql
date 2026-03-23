ALTER TABLE "campaign"
ALTER COLUMN "stats" SET DEFAULT '{"queued":0,"sent":0,"delivered":0,"failed":0}'::jsonb;
