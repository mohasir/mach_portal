ALTER TABLE "clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staff" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "option_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_price_tiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reschedule_reasons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "state_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_assignment_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_line_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_stage_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_stage_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quotes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_payment_attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_reschedules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_staff" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification_reads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "platform_access_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permission" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "clients_tenant_isolation" ON "clients" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "staff_tenant_isolation" ON "staff" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "option_groups_tenant_isolation" ON "option_groups" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "options_tenant_isolation" ON "options" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "product_price_tiers_tenant_isolation" ON "product_price_tiers" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "products_tenant_isolation" ON "products" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "event_types_tenant_isolation" ON "event_types" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "reschedule_reasons_tenant_isolation" ON "reschedule_reasons" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "app_settings_tenant_isolation" ON "app_settings" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "state_settings_tenant_isolation" ON "state_settings" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "quote_assignment_history_tenant_isolation" ON "quote_assignment_history" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "quote_line_options_tenant_isolation" ON "quote_line_options" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "quote_lines_tenant_isolation" ON "quote_lines" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "quote_stage_history_tenant_isolation" ON "quote_stage_history" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "quote_stage_settings_tenant_isolation" ON "quote_stage_settings" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "quotes_tenant_isolation" ON "quotes" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "event_history_tenant_isolation" ON "event_history" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "event_payment_attachments_tenant_isolation" ON "event_payment_attachments" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "event_payments_tenant_isolation" ON "event_payments" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "event_reschedules_tenant_isolation" ON "event_reschedules" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "event_staff_tenant_isolation" ON "event_staff" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "events_tenant_isolation" ON "events" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "templates_tenant_isolation" ON "templates" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "notification_reads_tenant_isolation" ON "notification_reads" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "notifications_tenant_isolation" ON "notifications" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "user_preferences_tenant_isolation" ON "user_preferences" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "platform_access_log_tenant_isolation" ON "platform_access_log" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "role_tenant_isolation" ON "role" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "role_audit_log_tenant_isolation" ON "role_audit_log" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
CREATE POLICY "role_permission_tenant_isolation" ON "role_permission" AS PERMISSIVE FOR ALL TO public USING (tenant_id = current_setting('app.tenant_id', true)) WITH CHECK (tenant_id = current_setting('app.tenant_id', true));--> statement-breakpoint
-- drizzle-kit does not emit FORCE: without it the table owner (the role running migrations) would bypass the policies.
ALTER TABLE "clients" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staff" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "option_groups" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "options" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_price_tiers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_types" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "reschedule_reasons" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "state_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_assignment_history" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_line_options" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_lines" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_stage_history" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quote_stage_settings" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quotes" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_history" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_payment_attachments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_payments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_reschedules" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "event_staff" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "events" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "templates" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification_reads" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_preferences" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "platform_access_log" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_audit_log" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "role_permission" FORCE ROW LEVEL SECURITY;