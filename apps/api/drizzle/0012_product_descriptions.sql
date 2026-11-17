ALTER TABLE "products" RENAME COLUMN "description" TO "short_description";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "long_description" text;