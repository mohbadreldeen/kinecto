CREATE TABLE "employee_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"token_hash" text NOT NULL,
	"invited_by_auth_user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_auth_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employee_invite_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "employee_invite" ADD CONSTRAINT "employee_invite_tenant_id_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "employee_invite_tenant_id_idx" ON "employee_invite" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "employee_invite_email_idx" ON "employee_invite" USING btree ("email");--> statement-breakpoint
CREATE INDEX "employee_invite_expires_at_idx" ON "employee_invite" USING btree ("expires_at");