CREATE TYPE "public"."payment_method" AS ENUM('zelle', 'cash', 'card', 'check', 'transfer');--> statement-breakpoint
CREATE TYPE "public"."state" AS ENUM('NY', 'NJ', 'CT');--> statement-breakpoint
CREATE TYPE "public"."option_group_type" AS ENUM('select', 'included');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('fixed', 'percent');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"must_change_password" boolean DEFAULT false,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"city" text,
	"state" "state",
	"address" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "option_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"label" text NOT NULL,
	"selection_type" "option_group_type" DEFAULT 'select' NOT NULL,
	"max_select" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"option_group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_price_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"num_persons" integer NOT NULL,
	"price" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "product_price_tiers_product_persons_unique" UNIQUE("product_id","num_persons")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_premium" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "products_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "event_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#1677ff' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "event_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "reschedule_reasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"requires_note" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "reschedule_reasons_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"deposit_rate" numeric(4, 3) DEFAULT 0.5 NOT NULL,
	"quote_validity_months" integer DEFAULT 3 NOT NULL,
	"min_persons_per_line" integer DEFAULT 30 NOT NULL,
	"quote_seq_start" integer DEFAULT 1 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"catalog_sortable" boolean DEFAULT true NOT NULL,
	"options_selection_deadline_days" integer DEFAULT 7 NOT NULL,
	"allow_select_options_at_quote" boolean DEFAULT true NOT NULL,
	"prompt_rate_changes" boolean DEFAULT false NOT NULL,
	"hide_stale_quotes" boolean DEFAULT true NOT NULL,
	"apply_tax_by_state" boolean DEFAULT false NOT NULL,
	"card_surcharge_rate" numeric(4, 3) DEFAULT 0.09 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_settings" (
	"state" "state" PRIMARY KEY NOT NULL,
	"tax_rate" numeric(6, 5) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_assignment_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"from_user_id" text,
	"to_user_id" text,
	"changed_by_id" text,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_line_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_line_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"option_group_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"num_persons" integer NOT NULL,
	"subtotal" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_stage_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"from_stage_id" integer,
	"to_stage_id" integer NOT NULL,
	"changed_by_id" text,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_stages" (
	"id" integer PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"color" text NOT NULL,
	"description" text,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" integer NOT NULL,
	"number" text NOT NULL,
	"client_id" uuid NOT NULL,
	"event_type_id" uuid,
	"event_date" date,
	"event_time" text,
	"state" "state",
	"address" text,
	"city" text,
	"notes" text,
	"client_notes" text,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"discount_type" "discount_type",
	"discount_value" numeric(10, 5),
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"long_distance_amount" integer DEFAULT 0 NOT NULL,
	"tax_rate" numeric(6, 5) NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"apply_card_surcharge" boolean DEFAULT false NOT NULL,
	"card_surcharge_rate" numeric(4, 3) DEFAULT 0.09 NOT NULL,
	"card_surcharge_amount" integer DEFAULT 0 NOT NULL,
	"deposit_rate" numeric(4, 3) DEFAULT 0.5 NOT NULL,
	"deposit_amount" integer DEFAULT 0 NOT NULL,
	"declined_rates" jsonb,
	"stage_id" integer DEFAULT 1 NOT NULL,
	"is_draft" boolean DEFAULT true NOT NULL,
	"select_options_at_quote" boolean DEFAULT false NOT NULL,
	"valid_until" date,
	"created_by_id" text,
	"assigned_to_id" text,
	"pdf_url" text,
	"pdf_key" text,
	"pdf_generated_at" timestamp,
	"archived_at" timestamp,
	"archived_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_seq_unique" UNIQUE("seq"),
	CONSTRAINT "quotes_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "event_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	"changed_by_id" text,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_payment_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"key" text NOT NULL,
	"url" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount" integer NOT NULL,
	"paid_at" date NOT NULL,
	"reference" text,
	"notes" text,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_reschedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"from_date" date,
	"from_time" text,
	"to_date" date NOT NULL,
	"to_time" text,
	"reason_id" uuid NOT NULL,
	"note" text,
	"staff_conflicts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rescheduled_by_id" text,
	"rescheduled_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"role" text,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "event_staff_event_staff_unique" UNIQUE("event_id","staff_id")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"event_type_id" uuid,
	"event_date" date,
	"event_time" text,
	"state" "state",
	"address" text,
	"city" text,
	"total_amount" integer NOT NULL,
	"deposit_paid" boolean DEFAULT false NOT NULL,
	"balance_paid" boolean DEFAULT false NOT NULL,
	"payment_method" "payment_method",
	"notes" text,
	"completed_at" timestamp,
	"selections_confirmed_at" timestamp,
	"selections_confirmed_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "events_quote_id_unique" UNIQUE("quote_id")
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"locale" text DEFAULT 'es' NOT NULL,
	"content" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "templates_type_locale_unique" UNIQUE("type","locale")
);
--> statement-breakpoint
CREATE TABLE "notification_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL,
	"dismissed_at" timestamp,
	CONSTRAINT "notification_reads_notification_user_unique" UNIQUE("notification_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"data" jsonb NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"excluded_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_groups" ADD CONSTRAINT "option_groups_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "options" ADD CONSTRAINT "options_option_group_id_option_groups_id_fk" FOREIGN KEY ("option_group_id") REFERENCES "public"."option_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_price_tiers" ADD CONSTRAINT "product_price_tiers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_assignment_history" ADD CONSTRAINT "quote_assignment_history_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_assignment_history" ADD CONSTRAINT "quote_assignment_history_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_assignment_history" ADD CONSTRAINT "quote_assignment_history_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_assignment_history" ADD CONSTRAINT "quote_assignment_history_changed_by_id_user_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_options" ADD CONSTRAINT "quote_line_options_quote_line_id_quote_lines_id_fk" FOREIGN KEY ("quote_line_id") REFERENCES "public"."quote_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_options" ADD CONSTRAINT "quote_line_options_option_id_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_line_options" ADD CONSTRAINT "quote_line_options_option_group_id_option_groups_id_fk" FOREIGN KEY ("option_group_id") REFERENCES "public"."option_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_stage_history" ADD CONSTRAINT "quote_stage_history_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_stage_history" ADD CONSTRAINT "quote_stage_history_from_stage_id_quote_stages_id_fk" FOREIGN KEY ("from_stage_id") REFERENCES "public"."quote_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_stage_history" ADD CONSTRAINT "quote_stage_history_to_stage_id_quote_stages_id_fk" FOREIGN KEY ("to_stage_id") REFERENCES "public"."quote_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_stage_history" ADD CONSTRAINT "quote_stage_history_changed_by_id_user_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_stage_id_quote_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."quote_stages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_assigned_to_id_user_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_archived_by_id_user_id_fk" FOREIGN KEY ("archived_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_history" ADD CONSTRAINT "event_history_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_history" ADD CONSTRAINT "event_history_changed_by_id_user_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_payment_attachments" ADD CONSTRAINT "event_payment_attachments_payment_id_event_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."event_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_payment_attachments" ADD CONSTRAINT "event_payment_attachments_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_payments" ADD CONSTRAINT "event_payments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_payments" ADD CONSTRAINT "event_payments_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reschedules" ADD CONSTRAINT "event_reschedules_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reschedules" ADD CONSTRAINT "event_reschedules_reason_id_reschedule_reasons_id_fk" FOREIGN KEY ("reason_id") REFERENCES "public"."reschedule_reasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_reschedules" ADD CONSTRAINT "event_reschedules_rescheduled_by_id_user_id_fk" FOREIGN KEY ("rescheduled_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_staff" ADD CONSTRAINT "event_staff_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_staff" ADD CONSTRAINT "event_staff_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_event_type_id_event_types_id_fk" FOREIGN KEY ("event_type_id") REFERENCES "public"."event_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_selections_confirmed_by_id_user_id_fk" FOREIGN KEY ("selections_confirmed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_reads" ADD CONSTRAINT "notification_reads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_excluded_user_id_user_id_fk" FOREIGN KEY ("excluded_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");