-- Multi-tenant core: the single legacy customer becomes tenant #1.
-- The migrator runs every pending migration in ONE transaction, so any failure below (missing
-- parameters, invalid slug, unexpected legacy data) leaves the database exactly as it was.
-- Parameters (only required when the database already has data), passed as startup settings:
--   pnpm --filter api db:migrate --set mt.tenant_slug=<slug> --set mt.tenant_name="<name>"

-- (a) Additive: new tables and nullable columns.
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"created_at" timestamp NOT NULL,
	"metadata" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"path" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_stage_settings" (
	"tenant_id" text NOT NULL,
	"stage_id" integer NOT NULL,
	"label" text,
	"color" text,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quote_stage_settings_tenant_id_stage_id_pk" PRIMARY KEY("tenant_id","stage_id")
);
--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_access_log" ADD CONSTRAINT "platform_access_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_access_log" ADD CONSTRAINT "platform_access_log_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quote_stage_settings" ADD CONSTRAINT "quote_stage_settings_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quote_stage_settings" ADD CONSTRAINT "quote_stage_settings_stage_id_quote_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."quote_stages"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "member_organizationId_userId_uidx" ON "member" USING btree ("organization_id","user_id");
--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");
--> statement-breakpoint
CREATE INDEX "platform_access_log_tenant_created_idx" ON "platform_access_log" USING btree ("tenant_id","created_at");
--> statement-breakpoint
CREATE INDEX "platform_access_log_user_idx" ON "platform_access_log" USING btree ("user_id");
--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "active_organization_id" text;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "is_platform_admin" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "option_groups" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "options" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "product_price_tiers" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "event_types" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "reschedule_reasons" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "state_settings" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "quote_assignment_history" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "quote_line_options" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "quote_stage_history" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "event_history" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "event_payment_attachments" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "event_payments" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "event_reschedules" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "event_staff" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "notification_reads" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "tenant_id" text;
--> statement-breakpoint
-- (b) Backfill. Runs only when the legacy database holds data, so an empty database (db:fresh,
-- a new environment) applies 0001 without parameters and gets no phantom tenant.
DO $$
DECLARE
  tenant_slug text := current_setting('mt.tenant_slug', true);
  tenant_name text := btrim(coalesce(current_setting('mt.tenant_name', true), ''));
  admin_emails text[] := array_remove(
    string_to_array(lower(replace(coalesce(current_setting('mt.platform_admin_emails', true), ''), ' ', '')), ','),
    ''
  );
  missing_email text;
  org_id text := gen_random_uuid()::text;
BEGIN
  IF NOT (EXISTS (SELECT 1 FROM "user") OR EXISTS (SELECT 1 FROM "clients") OR EXISTS (SELECT 1 FROM "staff") OR EXISTS (SELECT 1 FROM "option_groups") OR EXISTS (SELECT 1 FROM "options") OR EXISTS (SELECT 1 FROM "product_price_tiers") OR EXISTS (SELECT 1 FROM "products") OR EXISTS (SELECT 1 FROM "event_types") OR EXISTS (SELECT 1 FROM "reschedule_reasons") OR EXISTS (SELECT 1 FROM "app_settings") OR EXISTS (SELECT 1 FROM "state_settings") OR EXISTS (SELECT 1 FROM "quote_assignment_history") OR EXISTS (SELECT 1 FROM "quote_line_options") OR EXISTS (SELECT 1 FROM "quote_lines") OR EXISTS (SELECT 1 FROM "quote_stage_history") OR EXISTS (SELECT 1 FROM "quotes") OR EXISTS (SELECT 1 FROM "event_history") OR EXISTS (SELECT 1 FROM "event_payment_attachments") OR EXISTS (SELECT 1 FROM "event_payments") OR EXISTS (SELECT 1 FROM "event_reschedules") OR EXISTS (SELECT 1 FROM "event_staff") OR EXISTS (SELECT 1 FROM "events") OR EXISTS (SELECT 1 FROM "templates") OR EXISTS (SELECT 1 FROM "notification_reads") OR EXISTS (SELECT 1 FROM "notifications") OR EXISTS (SELECT 1 FROM "user_preferences")) THEN
    RETURN;
  END IF;

  IF coalesce(tenant_slug, '') = '' THEN
    RAISE EXCEPTION 'Migration 0001 needs the tenant #1 slug: run db:migrate with --set mt.tenant_slug=<slug> --set mt.tenant_name="<name>"';
  END IF;
  IF tenant_name = '' THEN
    RAISE EXCEPTION 'Migration 0001 needs the tenant #1 name: run db:migrate with --set mt.tenant_name="<name>"';
  END IF;
  -- Same format as isValidSlug in src/lib/tenant/slug.ts.
  IF tenant_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$' THEN
    RAISE EXCEPTION 'Invalid tenant slug "%": use 3-32 lowercase letters, digits or hyphens, not starting or ending with a hyphen', tenant_slug;
  END IF;
  -- The new primary key is tenant_id, so only the legacy singleton can be carried over.
  IF EXISTS (SELECT 1 FROM "app_settings" WHERE "id" <> 1) THEN
    RAISE EXCEPTION 'app_settings has rows other than the singleton id = 1; resolve them before migrating';
  END IF;
  SELECT e INTO missing_email FROM unnest(admin_emails) e
  WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE lower(u."email") = e)
  LIMIT 1;
  IF missing_email IS NOT NULL THEN
    RAISE EXCEPTION 'mt.platform_admin_emails lists "%", which is not an existing user', missing_email;
  END IF;

  INSERT INTO "organization" ("id", "name", "slug", "created_at")
  VALUES (org_id, tenant_name, tenant_slug, now());

  INSERT INTO "member" ("id", "organization_id", "user_id", "role", "created_at")
  SELECT gen_random_uuid()::text, org_id, u."id", coalesce(nullif(btrim(u."role"), ''), 'member'), now()
  FROM "user" u;

  -- An explicit mt.platform_admin_emails list wins; without it every superadmin is promoted.
  -- Better Auth's admin plugin stores several roles comma-separated.
  IF cardinality(admin_emails) > 0 THEN
    UPDATE "user" SET "is_platform_admin" = true WHERE lower("email") = ANY (admin_emails);
  ELSE
    UPDATE "user" SET "is_platform_admin" = true
    WHERE 'superadmin' = ANY (string_to_array(replace(coalesce("role", ''), ' ', ''), ','));
  END IF;

  -- Every open session keeps working: its tenant is the only organization.
  UPDATE "session" SET "active_organization_id" = org_id;

  -- The legacy app edited quote_stages in place, so its rows hold tenant #1's own wording:
  -- keep it as tenant #1's overlay so it survives any later reset of the global defaults.
  INSERT INTO "quote_stage_settings" ("tenant_id", "stage_id", "label", "color", "description")
  SELECT org_id, qs."id", qs."label", qs."color", qs."description" FROM "quote_stages" qs;

  UPDATE "app_settings" SET "tenant_id" = org_id;
  UPDATE "clients" SET "tenant_id" = org_id;
  UPDATE "staff" SET "tenant_id" = org_id;
  UPDATE "option_groups" SET "tenant_id" = org_id;
  UPDATE "options" SET "tenant_id" = org_id;
  UPDATE "product_price_tiers" SET "tenant_id" = org_id;
  UPDATE "products" SET "tenant_id" = org_id;
  UPDATE "event_types" SET "tenant_id" = org_id;
  UPDATE "reschedule_reasons" SET "tenant_id" = org_id;
  UPDATE "state_settings" SET "tenant_id" = org_id;
  UPDATE "quote_assignment_history" SET "tenant_id" = org_id;
  UPDATE "quote_line_options" SET "tenant_id" = org_id;
  UPDATE "quote_lines" SET "tenant_id" = org_id;
  UPDATE "quote_stage_history" SET "tenant_id" = org_id;
  UPDATE "quotes" SET "tenant_id" = org_id;
  UPDATE "event_history" SET "tenant_id" = org_id;
  UPDATE "event_payment_attachments" SET "tenant_id" = org_id;
  UPDATE "event_payments" SET "tenant_id" = org_id;
  UPDATE "event_reschedules" SET "tenant_id" = org_id;
  UPDATE "event_staff" SET "tenant_id" = org_id;
  UPDATE "events" SET "tenant_id" = org_id;
  UPDATE "templates" SET "tenant_id" = org_id;
  UPDATE "notification_reads" SET "tenant_id" = org_id;
  UPDATE "notifications" SET "tenant_id" = org_id;
  UPDATE "user_preferences" SET "tenant_id" = org_id;
END
$$;
--> statement-breakpoint
-- (c) Hardening: NOT NULL, foreign keys, indexes, per-tenant uniques and primary keys.
ALTER TABLE "clients" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "staff" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "option_groups" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "options" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "product_price_tiers" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "event_types" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "reschedule_reasons" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "app_settings" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "state_settings" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_assignment_history" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_line_options" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_lines" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "quote_stage_history" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "quotes" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "event_history" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "event_payment_attachments" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "event_payments" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "event_reschedules" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "event_staff" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "templates" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "notification_reads" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_preferences" ALTER COLUMN "tenant_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "option_groups" ADD CONSTRAINT "option_groups_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "options" ADD CONSTRAINT "options_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_price_tiers" ADD CONSTRAINT "product_price_tiers_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "reschedule_reasons" ADD CONSTRAINT "reschedule_reasons_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "state_settings" ADD CONSTRAINT "state_settings_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quote_assignment_history" ADD CONSTRAINT "quote_assignment_history_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quote_line_options" ADD CONSTRAINT "quote_line_options_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quote_stage_history" ADD CONSTRAINT "quote_stage_history_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_history" ADD CONSTRAINT "event_history_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_payment_attachments" ADD CONSTRAINT "event_payment_attachments_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_payments" ADD CONSTRAINT "event_payments_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_reschedules" ADD CONSTRAINT "event_reschedules_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "event_staff" ADD CONSTRAINT "event_staff_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "clients_tenant_idx" ON "clients" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "staff_tenant_idx" ON "staff" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "option_groups_tenant_idx" ON "option_groups" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "options_tenant_idx" ON "options" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "product_price_tiers_tenant_idx" ON "product_price_tiers" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "quote_assignment_history_tenant_idx" ON "quote_assignment_history" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "quote_line_options_tenant_idx" ON "quote_line_options" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "quote_lines_tenant_idx" ON "quote_lines" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "quote_stage_history_tenant_idx" ON "quote_stage_history" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "event_history_tenant_idx" ON "event_history" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "event_payment_attachments_tenant_idx" ON "event_payment_attachments" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "event_payments_tenant_idx" ON "event_payments" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "event_reschedules_tenant_idx" ON "event_reschedules" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "event_staff_tenant_idx" ON "event_staff" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "events_tenant_idx" ON "events" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "notification_reads_tenant_idx" ON "notification_reads" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "notifications_tenant_idx" ON "notifications" USING btree ("tenant_id");
--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_name_unique";
--> statement-breakpoint
ALTER TABLE "event_types" DROP CONSTRAINT "event_types_name_unique";
--> statement-breakpoint
ALTER TABLE "reschedule_reasons" DROP CONSTRAINT "reschedule_reasons_name_unique";
--> statement-breakpoint
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_seq_unique";
--> statement-breakpoint
ALTER TABLE "quotes" DROP CONSTRAINT "quotes_number_unique";
--> statement-breakpoint
ALTER TABLE "templates" DROP CONSTRAINT "templates_type_locale_unique";
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_name_unique" UNIQUE("tenant_id","name");
--> statement-breakpoint
ALTER TABLE "event_types" ADD CONSTRAINT "event_types_tenant_name_unique" UNIQUE("tenant_id","name");
--> statement-breakpoint
ALTER TABLE "reschedule_reasons" ADD CONSTRAINT "reschedule_reasons_tenant_name_unique" UNIQUE("tenant_id","name");
--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenant_seq_unique" UNIQUE("tenant_id","seq");
--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenant_number_unique" UNIQUE("tenant_id","number");
--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_tenant_type_locale_unique" UNIQUE("tenant_id","type","locale");
--> statement-breakpoint
ALTER TABLE "app_settings" DROP COLUMN "id";
--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY("tenant_id");
--> statement-breakpoint
ALTER TABLE "state_settings" DROP CONSTRAINT "state_settings_pkey";
--> statement-breakpoint
ALTER TABLE "state_settings" ADD CONSTRAINT "state_settings_tenant_id_state_pk" PRIMARY KEY("tenant_id","state");
--> statement-breakpoint
ALTER TABLE "user_preferences" DROP CONSTRAINT "user_preferences_pkey";
--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_tenant_id_user_id_pk" PRIMARY KEY("tenant_id","user_id");