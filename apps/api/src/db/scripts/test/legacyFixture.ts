import type postgres from 'postgres';

// Deterministic ids keep the fixture readable and make parent/child links explicit.
export const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const LEGACY_USERS = [
  { id: 'usr_super', email: 'super@legacy.test', role: 'superadmin' },
  { id: 'usr_admin', email: 'admin@legacy.test', role: 'admin' },
  { id: 'usr_operator', email: 'operator@legacy.test', role: 'operator' },
  { id: 'usr_member', email: 'member@legacy.test', role: 'member' },
  { id: 'usr_norole', email: 'norole@legacy.test', role: null },
] as const;

export const LEGACY_APP_SETTINGS = {
  deposit_rate: '0.350',
  quote_validity_months: 6,
  min_persons_per_line: 45,
  quote_seq_start: 1001,
  currency: 'EUR',
  catalog_sortable: false,
  options_selection_deadline_days: 12,
  allow_select_options_at_quote: false,
  prompt_rate_changes: true,
  hide_stale_quotes: false,
  apply_tax_by_state: true,
  card_surcharge_rate: '0.045',
  updated_at: '2026-03-04 05:06:07',
};

/**
 * Inserts rows in every table of the 0000 (single-tenant) schema with plain SQL, since the
 * legacy shape differs from the current Drizzle schema.
 */
export async function loadLegacyData(sql: postgres.Sql) {
  for (const u of LEGACY_USERS) {
    await sql`
      INSERT INTO "user" (id, name, email, email_verified, role, created_at, updated_at)
      VALUES (${u.id}, ${u.email}, ${u.email}, true, ${u.role}, '2025-01-01', '2025-01-02')`;
    await sql`
      INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
      VALUES (${'acc_' + u.id}, ${u.id}, 'credential', ${u.id}, 'hash', '2025-01-01', '2025-01-01')`;
  }
  await sql.unsafe(`
    INSERT INTO session (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id, impersonated_by) VALUES
      ('ses_1', '2030-01-01', 'tok_1', '2026-01-01', '2026-01-01', '10.0.0.1', 'ua', 'usr_super', NULL),
      ('ses_2', '2030-01-01', 'tok_2', '2026-01-01', '2026-01-01', NULL, NULL, 'usr_admin', NULL),
      ('ses_3', '2020-01-01', 'tok_3', '2019-12-01', '2019-12-01', NULL, NULL, 'usr_operator', 'usr_super'),
      ('ses_4', '2030-01-01', 'tok_4', '2026-01-01', '2026-01-01', NULL, NULL, 'usr_norole', NULL);
    INSERT INTO verification (id, identifier, value, expires_at) VALUES ('ver_1', 'reset:x', 'v', '2030-01-01');

    INSERT INTO clients (id, name, phone, email, city, state, address, notes, created_at, updated_at) VALUES
      ('${uid(1)}', 'Ana', '555', 'ana@c.test', 'Albany', 'NY', '1 St', 'vip', '2025-02-01', '2025-02-02'),
      ('${uid(2)}', 'Bob', NULL, NULL, NULL, NULL, NULL, NULL, '2025-02-03', '2025-02-03');
    INSERT INTO staff (id, name, phone, email, is_active, created_at) VALUES
      ('${uid(11)}', 'Chef A', '1', 'a@s.test', true, '2025-01-01'),
      ('${uid(12)}', 'Chef B', NULL, NULL, false, '2025-01-01');

    INSERT INTO products (id, name, description, is_premium, is_active, sort_order) VALUES
      ('${uid(21)}', 'Tacos', 'street', false, true, 1),
      ('${uid(22)}', 'Paella', NULL, true, false, 2);
    INSERT INTO product_price_tiers (id, product_id, num_persons, price, sort_order) VALUES
      ('${uid(31)}', '${uid(21)}', 30, 90000, 0),
      ('${uid(32)}', '${uid(21)}', 50, 140000, 1),
      ('${uid(33)}', '${uid(22)}', 30, 120000, 0);
    INSERT INTO option_groups (id, product_id, label, selection_type, max_select, is_active, sort_order) VALUES
      ('${uid(41)}', '${uid(21)}', 'Meats', 'select', 2, true, 0),
      ('${uid(42)}', '${uid(22)}', 'Included', 'included', NULL, true, 0);
    INSERT INTO options (id, option_group_id, name, description, is_active, sort_order) VALUES
      ('${uid(51)}', '${uid(41)}', 'Pastor', NULL, true, 0),
      ('${uid(52)}', '${uid(41)}', 'Asada', 'beef', true, 1),
      ('${uid(53)}', '${uid(42)}', 'Saffron', NULL, false, 0);

    INSERT INTO event_types (id, name, color, is_active, sort_order) VALUES
      ('${uid(61)}', 'Wedding', '#ff0000', true, 0),
      ('${uid(62)}', 'Birthday', '#00ff00', false, 1);
    INSERT INTO reschedule_reasons (id, name, requires_note, is_active, sort_order) VALUES
      ('${uid(71)}', 'Weather', false, true, 0),
      ('${uid(72)}', 'Other', true, true, 1);

    INSERT INTO app_settings (id, deposit_rate, quote_validity_months, min_persons_per_line, quote_seq_start,
      currency, catalog_sortable, options_selection_deadline_days, allow_select_options_at_quote,
      prompt_rate_changes, hide_stale_quotes, apply_tax_by_state, card_surcharge_rate, updated_at)
    VALUES (1, 0.35, 6, 45, 1001, 'EUR', false, 12, false, true, false, true, 0.045, '2026-03-04 05:06:07');
    INSERT INTO state_settings (state, tax_rate, updated_at) VALUES
      ('NY', 0.08875, '2026-01-01'), ('NJ', 0.06625, '2026-01-02'), ('CT', 0.0635, '2026-01-03');
    INSERT INTO templates (id, type, locale, content, updated_at) VALUES
      ('${uid(81)}', 'quote_pdf', 'es', '{"title":"Cotizacion"}', '2026-01-01'),
      ('${uid(82)}', 'quote_pdf', 'en', '{"title":"Quote"}', '2026-01-01');

    INSERT INTO quote_stages (id, label, color, description, sort_order) VALUES
      (1, 'Pending', '#faad14', 'new', 1), (2, 'Quoted', '#1677ff', NULL, 2), (3, 'Confirmed', '#52c41a', NULL, 3);
    INSERT INTO quotes (id, seq, number, client_id, event_type_id, event_date, state, subtotal, discount_type,
      discount_value, discount_amount, tax_rate, total, declined_rates, stage_id, is_draft, created_by_id,
      assigned_to_id, pdf_url, pdf_key, created_at, updated_at) VALUES
      ('${uid(101)}', 1001, 'QUO20260101-001001', '${uid(1)}', '${uid(61)}', '2026-05-01', 'NY', 90000, 'percent',
        10.5, 9450, 0.08875, 88000, '{"taxRate":0.07}', 1, true, 'usr_admin', 'usr_operator', NULL, NULL, '2026-01-01', '2026-01-01'),
      ('${uid(102)}', 1002, 'QUO20260102-001002', '${uid(1)}', '${uid(62)}', '2026-06-01', 'NJ', 140000, NULL,
        NULL, 0, 0.06625, 149000, NULL, 2, false, 'usr_super', NULL, 'https://r2/x.pdf', 'pdf/x', '2026-01-02', '2026-01-02'),
      ('${uid(103)}', 1003, 'QUO20260103-001003', '${uid(2)}', NULL, NULL, NULL, 120000, 'fixed',
        5000, 5000, 0, 115000, NULL, 3, false, 'usr_admin', 'usr_admin', NULL, NULL, '2026-01-03', '2026-01-03');
    INSERT INTO quote_lines (id, quote_id, product_id, num_persons, subtotal, sort_order) VALUES
      ('${uid(111)}', '${uid(101)}', '${uid(21)}', 30, 90000, 0),
      ('${uid(112)}', '${uid(102)}', '${uid(21)}', 50, 140000, 0),
      ('${uid(113)}', '${uid(103)}', '${uid(22)}', 30, 120000, 0);
    INSERT INTO quote_line_options (id, quote_line_id, option_id, option_group_id) VALUES
      ('${uid(121)}', '${uid(111)}', '${uid(51)}', '${uid(41)}'),
      ('${uid(122)}', '${uid(112)}', '${uid(52)}', '${uid(41)}');
    INSERT INTO quote_stage_history (id, quote_id, from_stage_id, to_stage_id, changed_by_id, changed_at) VALUES
      ('${uid(131)}', '${uid(102)}', 1, 2, 'usr_admin', '2026-01-05'),
      ('${uid(132)}', '${uid(103)}', 2, 3, NULL, '2026-01-06');
    INSERT INTO quote_assignment_history (id, quote_id, from_user_id, to_user_id, changed_by_id, changed_at) VALUES
      ('${uid(141)}', '${uid(101)}', NULL, 'usr_operator', 'usr_admin', '2026-01-01');

    INSERT INTO events (id, quote_id, client_id, event_type_id, event_date, event_time, state, total_amount,
      deposit_paid, payment_method, completed_at, selections_confirmed_at, selections_confirmed_by_id, created_at, updated_at) VALUES
      ('${uid(201)}', '${uid(102)}', '${uid(1)}', '${uid(62)}', '2026-06-01', '18:00', 'NJ', 149000, true, 'zelle',
        NULL, '2026-05-20', 'usr_operator', '2026-01-10', '2026-01-10'),
      ('${uid(202)}', '${uid(103)}', '${uid(2)}', NULL, NULL, NULL, NULL, 115000, false, NULL,
        '2026-02-01', NULL, NULL, '2026-01-11', '2026-01-11');
    INSERT INTO event_staff (id, event_id, staff_id, role, assigned_at) VALUES
      ('${uid(211)}', '${uid(201)}', '${uid(11)}', 'lead', '2026-01-12'),
      ('${uid(212)}', '${uid(201)}', '${uid(12)}', NULL, '2026-01-12');
    INSERT INTO event_payments (id, event_id, method, amount, paid_at, reference, created_by_id, created_at) VALUES
      ('${uid(221)}', '${uid(201)}', 'zelle', 74500, '2026-01-15', 'ref-1', 'usr_admin', '2026-01-15'),
      ('${uid(222)}', '${uid(202)}', 'cash', 115000, '2026-02-01', NULL, NULL, '2026-02-01');
    INSERT INTO event_payment_attachments (id, payment_id, key, url, file_name, mime_type, size, created_by_id, created_at) VALUES
      ('${uid(231)}', '${uid(221)}', 'att/1.png', 'https://r2/att/1.png', 'receipt.png', 'image/png', 2048, 'usr_admin', '2026-01-15');
    INSERT INTO event_history (id, event_id, type, data, changed_by_id, changed_at) VALUES
      ('${uid(241)}', '${uid(201)}', 'payment_registered', '{"amount":74500}', 'usr_admin', '2026-01-15'),
      ('${uid(242)}', '${uid(202)}', 'completed', '{}', NULL, '2026-02-01');
    INSERT INTO event_reschedules (id, event_id, from_date, from_time, to_date, to_time, reason_id, note, staff_conflicts,
      rescheduled_by_id, rescheduled_at) VALUES
      ('${uid(251)}', '${uid(201)}', '2026-05-25', '17:00', '2026-06-01', '18:00', '${uid(72)}', 'client asked',
        '[{"staffId":"${uid(12)}","name":"Chef B"}]', 'usr_admin', '2026-01-20');

    INSERT INTO notifications (id, type, data, entity_type, entity_id, excluded_user_id, created_at) VALUES
      ('${uid(301)}', 'quote_confirmed', '{"number":"QUO20260103-001003"}', 'quote', '${uid(103)}', 'usr_admin', '2026-01-06'),
      ('${uid(302)}', 'event_rescheduled', '{}', 'event', '${uid(201)}', NULL, '2026-01-20');
    INSERT INTO notification_reads (id, notification_id, user_id, read_at, dismissed_at) VALUES
      ('${uid(311)}', '${uid(301)}', 'usr_operator', '2026-01-07', NULL),
      ('${uid(312)}', '${uid(302)}', 'usr_operator', '2026-01-21', '2026-01-22');
    INSERT INTO user_preferences (user_id, preferences, updated_at) VALUES
      ('usr_admin', '{"theme":"dark"}', '2026-01-01'),
      ('usr_operator', '{}', '2026-01-02');
  `);
}
