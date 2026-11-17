-- Tax moves from the state of the quote to the product and the quote line. Saved quotes keep their
-- stored totals: every line takes the rate of its quote and a share of the tax already stored.
ALTER TABLE "app_settings" ADD COLUMN "default_tax_rate" numeric(6, 5) DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Only taxed quotes count: a newest draft saved without a state (rate 0) would otherwise leave every
-- product of the organization untaxed.
UPDATE "app_settings" s SET "default_tax_rate" = latest."tax_rate"
FROM (
  SELECT DISTINCT ON ("tenant_id") "tenant_id", "tax_rate"
  FROM "quotes"
  WHERE "tax_rate" > 0
  ORDER BY "tenant_id", "created_at" DESC, "seq" DESC
) latest
WHERE latest."tenant_id" = s."tenant_id";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tax_rate" numeric(6, 5);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "tax_exempt" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "products" p SET "tax_rate" = COALESCE(
  (SELECT s."default_tax_rate" FROM "app_settings" s WHERE s."tenant_id" = p."tenant_id"),
  0
);--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "tax_rate" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN "tax_rate" numeric(6, 5);--> statement-breakpoint
ALTER TABLE "quote_lines" ADD COLUMN "tax_amount" integer;--> statement-breakpoint
UPDATE "quote_lines" l SET "tax_rate" = q."tax_rate" FROM "quotes" q WHERE q."id" = l."quote_id";--> statement-breakpoint
-- The stored tax of each quote is split over its lines in proportion to their subtotal, the leftover
-- cents going to the largest remainders, so the lines add up to it exactly. A quote whose lines are
-- all at 0 puts its tax on its first line.
WITH weighted AS (
  SELECT l."id", l."quote_id", q."tax_amount" AS quote_tax,
    l."subtotal"::numeric AS weight,
    sum(l."subtotal") OVER (PARTITION BY l."quote_id")::numeric AS total_weight,
    row_number() OVER (PARTITION BY l."quote_id" ORDER BY l."sort_order", l."id") AS line_order
  FROM "quote_lines" l JOIN "quotes" q ON q."id" = l."quote_id"
), exact AS (
  SELECT *, CASE
    WHEN total_weight > 0 THEN quote_tax * weight / total_weight
    WHEN line_order = 1 THEN quote_tax
    ELSE 0
  END AS share
  FROM weighted
), floored AS (
  SELECT *, floor(share) AS whole, share - floor(share) AS remainder FROM exact
), ranked AS (
  SELECT *,
    quote_tax - sum(whole) OVER (PARTITION BY quote_id) AS leftover,
    row_number() OVER (PARTITION BY quote_id ORDER BY remainder DESC, line_order) AS remainder_rank
  FROM floored
)
UPDATE "quote_lines" l
SET "tax_amount" = (r.whole + CASE WHEN r.remainder_rank <= r.leftover THEN 1 ELSE 0 END)::integer
FROM ranked r WHERE r."id" = l."id";--> statement-breakpoint
ALTER TABLE "quote_lines" ALTER COLUMN "tax_rate" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_lines" ALTER COLUMN "tax_amount" SET NOT NULL;--> statement-breakpoint
DROP POLICY "state_settings_tenant_isolation" ON "state_settings" CASCADE;--> statement-breakpoint
DROP TABLE "state_settings" CASCADE;--> statement-breakpoint
ALTER TABLE "app_settings" DROP COLUMN "prompt_rate_changes";--> statement-breakpoint
ALTER TABLE "app_settings" DROP COLUMN "apply_tax_by_state";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "tax_rate";--> statement-breakpoint
ALTER TABLE "quotes" DROP COLUMN "declined_rates";
