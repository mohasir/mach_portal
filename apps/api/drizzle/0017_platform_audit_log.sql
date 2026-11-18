CREATE TABLE "platform_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"tenant_id" text,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "platform_audit_log" ADD CONSTRAINT "platform_audit_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_audit_log" ADD CONSTRAINT "platform_audit_log_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_audit_log_tenant_created_idx" ON "platform_audit_log" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "platform_audit_log_user_idx" ON "platform_audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "platform_audit_log_created_idx" ON "platform_audit_log" USING btree ("created_at");--> statement-breakpoint
-- drizzle-kit does not emit FORCE: without it the table owner (the role running migrations) would bypass RLS.
ALTER TABLE "platform_audit_log" FORCE ROW LEVEL SECURITY;
