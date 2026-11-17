CREATE TABLE "tenant_profile" (
	"tenant_id" text PRIMARY KEY NOT NULL,
	"catalog_kind" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_profile" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_profile" ADD CONSTRAINT "tenant_profile_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "tenant_profile_tenant_read" ON "tenant_profile" AS PERMISSIVE FOR SELECT TO public USING (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
INSERT INTO "tenant_profile" ("tenant_id", "catalog_kind")
SELECT "id", 'products' FROM "organization"
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- drizzle-kit does not emit FORCE: without it the table owner (the role running migrations) would bypass the policy.
ALTER TABLE "tenant_profile" FORCE ROW LEVEL SECURITY;
