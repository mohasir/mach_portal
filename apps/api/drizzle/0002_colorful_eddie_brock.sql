CREATE TYPE "public"."permission_scope" AS ENUM('own', 'all');--> statement-breakpoint
CREATE TABLE "role" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"is_owner" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "role_tenant_name_uq" UNIQUE("tenant_id","name")
);
--> statement-breakpoint
CREATE TABLE "role_audit_log" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"tenant_id" text NOT NULL,
	"actor_user_id" text NOT NULL,
	"role_id" text,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"role_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"scope" "permission_scope" DEFAULT 'all' NOT NULL,
	CONSTRAINT "role_permission_role_id_resource_action_pk" PRIMARY KEY("role_id","resource","action")
);
--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "role_id" text;--> statement-breakpoint
ALTER TABLE "role" ADD CONSTRAINT "role_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_audit_log" ADD CONSTRAINT "role_audit_log_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_audit_log" ADD CONSTRAINT "role_audit_log_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "role_one_owner_per_tenant_uidx" ON "role" USING btree ("tenant_id") WHERE "role"."is_owner";--> statement-breakpoint
CREATE INDEX "role_audit_log_tenant_created_idx" ON "role_audit_log" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "role_audit_log_role_idx" ON "role_audit_log" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "role_permission_tenant_idx" ON "role_permission" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_roleId_idx" ON "member" USING btree ("role_id");