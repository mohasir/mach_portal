CREATE TABLE "tenant_feature_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"feature_key" text NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"actor" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_feature_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenant_features" (
	"tenant_id" text NOT NULL,
	"feature_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"price_cents" integer,
	"billing_period" text,
	"currency" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_features_tenant_id_feature_key_pk" PRIMARY KEY("tenant_id","feature_key")
);
--> statement-breakpoint
ALTER TABLE "tenant_features" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "price" integer;--> statement-breakpoint
ALTER TABLE "tenant_feature_events" ADD CONSTRAINT "tenant_feature_events_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_features" ADD CONSTRAINT "tenant_features_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tenant_feature_events_tenant_created_idx" ON "tenant_feature_events" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE POLICY "tenant_features_tenant_read" ON "tenant_features" AS PERMISSIVE FOR SELECT TO public USING (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- Organizations that predate feature flags keep every paid feature, permanently and without a price.
-- It runs before FORCE: afterwards the owner running the migration is bound by the read-only policy.
INSERT INTO "tenant_features" ("tenant_id", "feature_key")
SELECT o.id, k FROM "organization" o
CROSS JOIN unnest(ARRAY['quotes','events','notifications','priceTiers','configurableOptions']) k
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- drizzle-kit does not emit FORCE: without it the table owner (the role running migrations) would bypass the policies.
ALTER TABLE "tenant_features" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_feature_events" FORCE ROW LEVEL SECURITY;
