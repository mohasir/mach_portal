-- Product categories, SKU, cost and minimum quantity per product.
-- product_cost (read and update) is granted to every existing role that holds product.update,
-- custom roles included, not only the base Admin role: review those roles after migrating.
CREATE TABLE "product_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "category_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sku" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "cost" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "min_quantity" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "product_categories_tenant_name_uidx" ON "product_categories" USING btree ("tenant_id",lower("name"));--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_product_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "products_tenant_sku_uidx" ON "products" USING btree ("tenant_id",lower("sku")) WHERE "products"."sku" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
-- The minimum quantity per quote line moves from the organization setting to every product of
-- that organization, before the setting is dropped. The setting never applied to price tiers, so a
-- tiered product keeps its smallest tier quotable: it takes the lower of the two.
UPDATE "products" p SET "min_quantity" = GREATEST(1, LEAST(
  s."min_persons_per_line",
  COALESCE(
    (SELECT min(t."quantity") FROM "product_price_tiers" t
     WHERE t."product_id" = p."id" AND t."tenant_id" = p."tenant_id"),
    s."min_persons_per_line"
  )
))
FROM "app_settings" s
WHERE s."tenant_id" = p."tenant_id";--> statement-breakpoint
ALTER TABLE "app_settings" DROP COLUMN "min_persons_per_line";--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_min_quantity_check" CHECK (min_quantity >= 1);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_cost_check" CHECK (cost >= 0);--> statement-breakpoint
CREATE POLICY "product_categories_tenant_isolation" ON "product_categories" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- Existing roles receive product_category at the level they hold on product (both resources name
-- these actions alike), and the roles that edit products receive product_cost, as the base role
-- templates do for new organizations. Only roles that gained a permission get the version bump,
-- which makes open sessions reload their permissions.
WITH "granted" AS (
  INSERT INTO "role_permission" ("role_id", "tenant_id", "resource", "action", "scope")
  SELECT p."role_id", p."tenant_id", 'product_category', p."action", 'all'::"permission_scope"
  FROM "role_permission" p
  WHERE p."resource" = 'product'
    AND p."action" IN ('create', 'read', 'update', 'delete', 'disable', 'enable')
  UNION ALL
  SELECT p."role_id", p."tenant_id", 'product_cost', c."action", 'all'::"permission_scope"
  FROM "role_permission" p CROSS JOIN (VALUES ('read'), ('update')) AS c("action")
  WHERE p."resource" = 'product' AND p."action" = 'update'
  ON CONFLICT DO NOTHING
  RETURNING "role_id"
)
UPDATE "role" r SET "version" = r."version" + 1, "updated_at" = now()
WHERE r."id" IN (SELECT "role_id" FROM "granted");--> statement-breakpoint
-- drizzle-kit does not emit FORCE: without it the table owner (the role running migrations) would bypass the policy.
ALTER TABLE "product_categories" FORCE ROW LEVEL SECURITY;
