ALTER TABLE "quote_lines" ADD COLUMN "uom_id" uuid;--> statement-breakpoint
UPDATE "quote_lines" SET "uom_id" = "products"."uom_id" FROM "products" WHERE "products"."id" = "quote_lines"."product_id";--> statement-breakpoint
ALTER TABLE "quote_lines" ALTER COLUMN "uom_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_uom_id_units_of_measure_id_fk" FOREIGN KEY ("uom_id") REFERENCES "public"."units_of_measure"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_lines_tenant_uom_idx" ON "quote_lines" USING btree ("tenant_id","uom_id");
