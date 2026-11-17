-- Long distance and the card surcharge stop being quote columns and become charges of a catalog per
-- organization (add-on extraCharges). Only organizations with a quote that used them receive the
-- charge types, the quote_charges copies with the stored amounts and the add-on. Stored quote totals
-- are not recalculated.
CREATE TYPE "public"."charge_kind" AS ENUM('fixed', 'percent');--> statement-breakpoint
CREATE TABLE "charge_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" charge_kind NOT NULL,
	"default_value" numeric(14, 5) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "charge_types_default_value_check" CHECK ((kind = 'percent' AND default_value >= 0 AND default_value <= 1) OR (kind = 'fixed' AND default_value >= 0 AND default_value = trunc(default_value)))
);
--> statement-breakpoint
ALTER TABLE "charge_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "quote_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"quote_id" uuid NOT NULL,
	"charge_type_id" uuid,
	"name" text NOT NULL,
	"kind" charge_kind NOT NULL,
	"value" numeric(14, 5) NOT NULL,
	"amount" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "quote_charges_value_check" CHECK ((kind = 'percent' AND value >= 0 AND value <= 1) OR (kind = 'fixed' AND value >= 0 AND value = trunc(value)))
);
--> statement-breakpoint
ALTER TABLE "quote_charges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "charge_types" ADD CONSTRAINT "charge_types_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_charges" ADD CONSTRAINT "quote_charges_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_charges" ADD CONSTRAINT "quote_charges_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_charges" ADD CONSTRAINT "quote_charges_charge_type_id_charge_types_id_fk" FOREIGN KEY ("charge_type_id") REFERENCES "public"."charge_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "charge_types_tenant_name_uidx" ON "charge_types" USING btree ("tenant_id",lower("name"));--> statement-breakpoint
CREATE INDEX "quote_charges_tenant_quote_idx" ON "quote_charges" USING btree ("tenant_id","quote_id");--> statement-breakpoint
CREATE INDEX "quote_charges_charge_type_idx" ON "quote_charges" USING btree ("charge_type_id");--> statement-breakpoint
INSERT INTO "charge_types" ("tenant_id", "name", "kind", "default_value", "sort_order")
SELECT DISTINCT q."tenant_id", 'Larga distancia', 'fixed'::"charge_kind", 0, 0
FROM "quotes" q
WHERE q."long_distance_amount" > 0;--> statement-breakpoint
-- The surcharge type starts with the organization's configured rate (the old column default when
-- the organization has no settings row).
INSERT INTO "charge_types" ("tenant_id", "name", "kind", "default_value", "sort_order")
SELECT t."tenant_id", 'Recargo por tarjeta', 'percent'::"charge_kind",
       COALESCE(s."card_surcharge_rate", 0.09), 1
FROM (SELECT DISTINCT "tenant_id" FROM "quotes" WHERE "apply_card_surcharge") t
LEFT JOIN "app_settings" s ON s."tenant_id" = t."tenant_id";--> statement-breakpoint
INSERT INTO "quote_charges"
  ("tenant_id", "quote_id", "charge_type_id", "name", "kind", "value", "amount", "sort_order")
SELECT q."tenant_id", q."id", ct."id", ct."name", ct."kind", q."long_distance_amount",
       q."long_distance_amount", 0
FROM "quotes" q
JOIN "charge_types" ct
  ON ct."tenant_id" = q."tenant_id" AND ct."kind" = 'fixed' AND ct."name" = 'Larga distancia'
WHERE q."long_distance_amount" > 0;--> statement-breakpoint
INSERT INTO "quote_charges"
  ("tenant_id", "quote_id", "charge_type_id", "name", "kind", "value", "amount", "sort_order")
SELECT q."tenant_id", q."id", ct."id", ct."name", ct."kind", q."card_surcharge_rate",
       q."card_surcharge_amount", 1
FROM "quotes" q
JOIN "charge_types" ct
  ON ct."tenant_id" = q."tenant_id" AND ct."kind" = 'percent' AND ct."name" = 'Recargo por tarjeta'
WHERE q."apply_card_surcharge";--> statement-breakpoint
-- Permanent and unpriced, like the rows of 0006; organizations that never used these charges are
-- left without the add-on.
INSERT INTO "tenant_features" ("tenant_id", "feature_key")
SELECT DISTINCT "tenant_id", 'extraCharges' FROM "charge_types"
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Existing roles receive charge_type as the base role templates give it to new organizations: the
-- roles that edit tax rates manage the catalog (enable stays with the owner), the roles that create
-- quotes read it. Only roles that gained a permission get the version bump.
WITH "granted" AS (
  INSERT INTO "role_permission" ("role_id", "tenant_id", "resource", "action", "scope")
  SELECT p."role_id", p."tenant_id", 'charge_type', c."action", 'all'::"permission_scope"
  FROM "role_permission" p
  CROSS JOIN (VALUES ('create'), ('read'), ('update'), ('disable')) AS c("action")
  WHERE p."resource" = 'tax_rates' AND p."action" = 'update'
  UNION
  SELECT p."role_id", p."tenant_id", 'charge_type', 'read', 'all'::"permission_scope"
  FROM "role_permission" p
  WHERE p."resource" = 'quote' AND p."action" = 'create'
  ON CONFLICT DO NOTHING
  RETURNING "role_id"
)
UPDATE "role" r SET "version" = r."version" + 1, "updated_at" = now()
WHERE r."id" IN (SELECT "role_id" FROM "granted");--> statement-breakpoint
ALTER TABLE "app_settings" DROP COLUMN "card_surcharge_rate";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "long_distance_amount";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "apply_card_surcharge";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "card_surcharge_rate";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "card_surcharge_amount";--> statement-breakpoint
CREATE POLICY "charge_types_tenant_isolation" ON "charge_types" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "quote_charges_tenant_isolation" ON "quote_charges" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- drizzle-kit does not emit FORCE: without it the table owner (the role running migrations) would bypass the policy.
ALTER TABLE "charge_types" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_charges" FORCE ROW LEVEL SECURITY;
