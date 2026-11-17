ALTER TABLE "quote_lines" RENAME COLUMN "num_persons" TO "quantity";--> statement-breakpoint
ALTER TABLE "product_price_tiers" RENAME COLUMN "num_persons" TO "quantity";--> statement-breakpoint
ALTER TABLE "product_price_tiers" RENAME CONSTRAINT "product_price_tiers_product_persons_unique" TO "product_price_tiers_product_quantity_unique";--> statement-breakpoint
-- PostgreSQL 18 names NOT NULL constraints and keeps the old name on a column rename.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_lines_num_persons_not_null') THEN
    ALTER TABLE "quote_lines" RENAME CONSTRAINT "quote_lines_num_persons_not_null" TO "quote_lines_quantity_not_null";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_price_tiers_num_persons_not_null') THEN
    ALTER TABLE "product_price_tiers" RENAME CONSTRAINT "product_price_tiers_num_persons_not_null" TO "product_price_tiers_quantity_not_null";
  END IF;
END $$;
