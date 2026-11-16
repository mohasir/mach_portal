CREATE TYPE "public"."uom_dimension" AS ENUM('quantity', 'time', 'weight', 'volume', 'length');--> statement-breakpoint
CREATE TABLE "units_of_measure" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"plural_name" text NOT NULL,
	"code" text NOT NULL,
	"dimension" "uom_dimension" NOT NULL,
	"factor" numeric(24, 10) NOT NULL,
	"is_base" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "units_of_measure_tenant_code_unique" UNIQUE("tenant_id","code"),
	CONSTRAINT "units_of_measure_factor_check" CHECK (factor > 0 AND (NOT is_base OR factor = 1))
);
--> statement-breakpoint
ALTER TABLE "units_of_measure" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "units_of_measure" ADD CONSTRAINT "units_of_measure_tenant_id_organization_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "units_of_measure_one_base_per_dimension_uidx" ON "units_of_measure" USING btree ("tenant_id","dimension") WHERE "units_of_measure"."is_base";--> statement-breakpoint
CREATE POLICY "units_of_measure_tenant_isolation" ON "units_of_measure" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- Every existing organization receives the system units; this list must match SYSTEM_UNITS in
-- @repo/schemas (a test compares them).
INSERT INTO "units_of_measure" ("tenant_id", "code", "name", "plural_name", "dimension", "factor", "is_base", "is_system", "sort_order")
SELECT o."id", u."code", u."name", u."plural_name", u."dimension"::"uom_dimension", u."factor", u."is_base", true, u."sort_order"
FROM "organization" o
CROSS JOIN (VALUES
  ('und', 'Unidad', 'Unidades', 'quantity', 1, true, 0),
  ('pers', 'Persona', 'Personas', 'quantity', 1, false, 1),
  ('serv', 'Servicio', 'Servicios', 'quantity', 1, false, 2),
  ('caja', 'Caja', 'Cajas', 'quantity', 1, false, 3),
  ('par', 'Par', 'Pares', 'quantity', 2, false, 4),
  ('doc', 'Docena', 'Docenas', 'quantity', 12, false, 5),
  ('min', 'Minuto', 'Minutos', 'time', 1, true, 6),
  ('h', 'Hora', 'Horas', 'time', 60, false, 7),
  ('d', 'Día', 'Días', 'time', 1440, false, 8),
  ('sem', 'Semana', 'Semanas', 'time', 10080, false, 9),
  ('g', 'Gramo', 'Gramos', 'weight', 1, true, 10),
  ('kg', 'Kilogramo', 'Kilogramos', 'weight', 1000, false, 11),
  ('lb', 'Libra', 'Libras', 'weight', 453.59237, false, 12),
  ('oz', 'Onza', 'Onzas', 'weight', 28.349523125, false, 13),
  ('ml', 'Mililitro', 'Mililitros', 'volume', 1, true, 14),
  ('l', 'Litro', 'Litros', 'volume', 1000, false, 15),
  ('fl oz', 'Onza líquida', 'Onzas líquidas', 'volume', 29.5735295625, false, 16),
  ('gal', 'Galón', 'Galones', 'volume', 3785.411784, false, 17),
  ('mm', 'Milímetro', 'Milímetros', 'length', 1, true, 18),
  ('cm', 'Centímetro', 'Centímetros', 'length', 10, false, 19),
  ('m', 'Metro', 'Metros', 'length', 1000, false, 20),
  ('in', 'Pulgada', 'Pulgadas', 'length', 25.4, false, 21),
  ('ft', 'Pie', 'Pies', 'length', 304.8, false, 22)
) AS u("code", "name", "plural_name", "dimension", "factor", "is_base", "sort_order")
ON CONFLICT ("tenant_id", "code") DO NOTHING;--> statement-breakpoint
-- Added nullable so existing products can be assigned the "Persona" unit before the constraint.
ALTER TABLE "products" ADD COLUMN "uom_id" uuid;--> statement-breakpoint
UPDATE "products" p SET "uom_id" = u."id"
FROM "units_of_measure" u
WHERE u."tenant_id" = p."tenant_id" AND u."code" = 'pers';--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "uom_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_uom_idx" ON "products" USING btree ("uom_id");--> statement-breakpoint
-- Existing roles receive unit_of_measure at the level they hold on product (both resources name
-- these actions alike), as the base role templates do for new organizations. The version bump
-- makes open sessions reload their permissions.
INSERT INTO "role_permission" ("role_id", "tenant_id", "resource", "action", "scope")
SELECT p."role_id", p."tenant_id", 'unit_of_measure', p."action", 'all'
FROM "role_permission" p
WHERE p."resource" = 'product' AND p."action" IN ('create', 'read', 'update', 'disable', 'enable')
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "role" r SET "version" = r."version" + 1, "updated_at" = now()
WHERE EXISTS (
  SELECT 1 FROM "role_permission" p WHERE p."role_id" = r."id" AND p."resource" = 'unit_of_measure'
);--> statement-breakpoint
-- drizzle-kit does not emit FORCE: without it the table owner (the role running migrations) would bypass the policy.
ALTER TABLE "units_of_measure" FORCE ROW LEVEL SECURITY;
