-- The fixed NY/NJ/CT state becomes an operating location each organization configures. Quotes and
-- events keep their place as text (country, region, locality): every stored state/city is copied as
-- country 'US', region = the state code and locality = the city. Organizations with any quote or
-- event that had a state are enabled for the US down to the city, covering the whole country and
-- asking for the address; the rest get no row (turned off). Client state and city are discarded.
CREATE TABLE "tenant_location" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"country" text,
	"depth" smallint,
	"scope" text,
	"ask_address" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_location_depth_check" CHECK (depth BETWEEN 0 AND 2),
	CONSTRAINT "tenant_location_scope_check" CHECK (scope IN ('country', 'areas')),
	CONSTRAINT "tenant_location_enabled_complete_check" CHECK (NOT enabled OR (country IS NOT NULL AND depth IS NOT NULL AND scope IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "tenant_location" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenant_location_areas" (
	"tenant_id" text NOT NULL,
	"region" text NOT NULL,
	"locality" text
);
--> statement-breakpoint
ALTER TABLE "tenant_location_areas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "quotes" ADD COLUMN "locality" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "locality" text;--> statement-breakpoint
ALTER TABLE "tenant_location" ADD CONSTRAINT "tenant_location_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_location_areas" ADD CONSTRAINT "tenant_location_areas_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_location_areas" ADD CONSTRAINT "tenant_location_areas_tenant_id_tenant_location_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenant_location"("tenant_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_location_areas_uidx" ON "tenant_location_areas" USING btree ("tenant_id","region",coalesce("locality", ''));--> statement-breakpoint
UPDATE "quotes" SET "country" = 'US', "region" = "state"::text, "locality" = NULLIF(btrim("city"), '')
WHERE "state" IS NOT NULL;--> statement-breakpoint
UPDATE "events" SET "country" = 'US', "region" = "state"::text, "locality" = NULLIF(btrim("city"), '')
WHERE "state" IS NOT NULL;--> statement-breakpoint
INSERT INTO "tenant_location" ("tenant_id", "enabled", "country", "depth", "scope", "ask_address")
SELECT t."tenant_id", true, 'US', 2, 'country', true
FROM (
  SELECT "tenant_id" FROM "quotes" WHERE "state" IS NOT NULL
  UNION
  SELECT "tenant_id" FROM "events" WHERE "state" IS NOT NULL
) t;--> statement-breakpoint
-- Existing roles receive location_settings as the base role templates give it to new organizations:
-- whoever sees or edits the tax rates sees or edits the location. Only roles that gained a
-- permission get the version bump.
WITH "granted" AS (
  INSERT INTO "role_permission" ("role_id", "tenant_id", "resource", "action", "scope")
  SELECT p."role_id", p."tenant_id", 'location_settings', p."action", 'all'::"permission_scope"
  FROM "role_permission" p
  WHERE p."resource" = 'tax_rates' AND p."action" IN ('view', 'update')
  ON CONFLICT DO NOTHING
  RETURNING "role_id"
)
UPDATE "role" r SET "version" = r."version" + 1, "updated_at" = now()
WHERE r."id" IN (SELECT "role_id" FROM "granted");--> statement-breakpoint
ALTER TABLE "clients" DROP COLUMN "city";--> statement-breakpoint
ALTER TABLE "clients" DROP COLUMN "state";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "state";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "city";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "state";--> statement-breakpoint
ALTER TABLE "events" DROP COLUMN "city";--> statement-breakpoint
CREATE POLICY "tenant_location_tenant_isolation" ON "tenant_location" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "tenant_location_areas_tenant_isolation" ON "tenant_location_areas" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
DROP TYPE "public"."state";--> statement-breakpoint
-- drizzle-kit does not emit FORCE: without it the table owner (the role running migrations) would bypass the policy.
ALTER TABLE "tenant_location" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_location_areas" FORCE ROW LEVEL SECURITY;
