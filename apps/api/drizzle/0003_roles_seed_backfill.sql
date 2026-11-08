-- Seeds the four base roles for every organization that has none and links each member to
-- its role by the legacy member.role text. The role data below is a frozen snapshot of the
-- permission matrix at the time of writing, so this migration never depends on live code.
-- Idempotent; a member whose role is not a base role aborts the whole migration.
DO $$
DECLARE
  unknown_roles text;
BEGIN
  SELECT string_agg(DISTINCT '"' || coalesce(role, '<null>') || '"', ', ') INTO unknown_roles
  FROM "member"
  WHERE role_id IS NULL AND NOT (coalesce(role, '') = ANY (ARRAY['superadmin', 'admin', 'operator', 'member']));
  IF unknown_roles IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot backfill member.role_id: unknown member role(s) %', unknown_roles;
  END IF;

  CREATE TEMP TABLE _base_role (key text, name text, is_owner boolean) ON COMMIT DROP;
  INSERT INTO _base_role (key, name, is_owner) VALUES
    ('superadmin', 'Superadmin', true),
    ('admin', 'Admin', false),
    ('operator', 'Operator', false),
    ('member', 'Member', false);

  CREATE TEMP TABLE _base_permission (key text, resource text, action text, scope text) ON COMMIT DROP;
  INSERT INTO _base_permission (key, resource, action, scope) VALUES
    ('admin', 'user', 'list', 'all'),
    ('admin', 'dashboard', 'read', 'all'),
    ('admin', 'dashboard', 'view_summary', 'all'),
    ('admin', 'dashboard', 'view_quotes_chart', 'all'),
    ('admin', 'dashboard', 'view_top_products', 'all'),
    ('admin', 'event', 'create', 'all'),
    ('admin', 'event', 'read', 'all'),
    ('admin', 'event', 'update', 'all'),
    ('admin', 'event', 'delete', 'all'),
    ('admin', 'event', 'manage_selections', 'all'),
    ('admin', 'event', 'manage_staff_assignments', 'all'),
    ('admin', 'event', 'reschedule', 'all'),
    ('admin', 'event', 'view_reschedules', 'all'),
    ('admin', 'payment', 'create', 'all'),
    ('admin', 'payment', 'read', 'all'),
    ('admin', 'payment', 'delete', 'all'),
    ('admin', 'payment', 'upload_attachment', 'all'),
    ('admin', 'client', 'create', 'all'),
    ('admin', 'client', 'read', 'all'),
    ('admin', 'client', 'update', 'all'),
    ('admin', 'client', 'delete', 'all'),
    ('admin', 'quote', 'create', 'all'),
    ('admin', 'quote', 'read', 'all'),
    ('admin', 'quote', 'update', 'all'),
    ('admin', 'quote', 'delete', 'all'),
    ('admin', 'quote', 'manage_line_pricing', 'all'),
    ('admin', 'quote', 'manage_assignment', 'all'),
    ('admin', 'pipeline', 'create', 'all'),
    ('admin', 'pipeline', 'read', 'all'),
    ('admin', 'pipeline', 'update', 'all'),
    ('admin', 'pipeline', 'delete', 'all'),
    ('admin', 'staff', 'create', 'all'),
    ('admin', 'staff', 'read', 'all'),
    ('admin', 'staff', 'update', 'all'),
    ('admin', 'staff', 'delete', 'all'),
    ('admin', 'product', 'create', 'all'),
    ('admin', 'product', 'read', 'all'),
    ('admin', 'product', 'update', 'all'),
    ('admin', 'product', 'delete', 'all'),
    ('admin', 'product', 'disable', 'all'),
    ('admin', 'product', 'duplicate', 'all'),
    ('admin', 'product_option', 'delete', 'all'),
    ('admin', 'price_tiers', 'create', 'all'),
    ('admin', 'price_tiers', 'read', 'all'),
    ('admin', 'price_tiers', 'update', 'all'),
    ('admin', 'price_tiers', 'delete', 'all'),
    ('admin', 'event_type', 'create', 'all'),
    ('admin', 'event_type', 'read', 'all'),
    ('admin', 'event_type', 'update', 'all'),
    ('admin', 'event_type', 'delete', 'all'),
    ('admin', 'reschedule_reason', 'read', 'all'),
    ('admin', 'tax_rates', 'view', 'all'),
    ('admin', 'tax_rates', 'update', 'all'),
    ('admin', 'quote_defaults', 'view', 'all'),
    ('admin', 'quote_defaults', 'update', 'all'),
    ('admin', 'quote_pdf_template', 'view', 'all'),
    ('admin', 'quote_pdf_template', 'update', 'all'),
    ('operator', 'event', 'read', 'own'),
    ('operator', 'event', 'manage_staff_assignments', 'own'),
    ('operator', 'event', 'view_reschedules', 'own'),
    ('operator', 'client', 'create', 'all'),
    ('operator', 'client', 'read', 'all'),
    ('operator', 'client', 'update', 'all'),
    ('operator', 'client', 'delete', 'all'),
    ('operator', 'quote', 'create', 'own'),
    ('operator', 'quote', 'read', 'own'),
    ('operator', 'quote', 'update', 'own'),
    ('operator', 'quote', 'delete', 'own'),
    ('operator', 'pipeline', 'create', 'all'),
    ('operator', 'pipeline', 'read', 'all'),
    ('operator', 'pipeline', 'update', 'all'),
    ('operator', 'pipeline', 'delete', 'all'),
    ('operator', 'product', 'read', 'all'),
    ('operator', 'event_type', 'read', 'all'),
    ('operator', 'staff', 'read', 'all');

  -- Only organizations without any role are seeded, so re-running never touches customized roles.
  CREATE TEMP TABLE _new_role (id text, tenant_id text, name text) ON COMMIT DROP;
  WITH inserted AS (
    INSERT INTO "role" ("tenant_id", "name", "is_owner")
    SELECT o.id, b.name, b.is_owner
    FROM "organization" o CROSS JOIN _base_role b
    WHERE NOT EXISTS (SELECT 1 FROM "role" r WHERE r.tenant_id = o.id)
    RETURNING id, tenant_id, name
  )
  INSERT INTO _new_role SELECT id, tenant_id, name FROM inserted;

  INSERT INTO "role_permission" ("role_id", "tenant_id", "resource", "action", "scope")
  SELECT n.id, n.tenant_id, p.resource, p.action, p.scope::permission_scope
  FROM _new_role n
  JOIN _base_role b ON b.name = n.name
  JOIN _base_permission p ON p.key = b.key;

  UPDATE "member" m
  SET role_id = r.id
  FROM _base_role b, "role" r
  WHERE m.role_id IS NULL
    AND b.key = m.role
    AND r.tenant_id = m.organization_id
    AND r.name = b.name;

  -- An organization that already had roles, none of them named like the member's base role.
  IF EXISTS (SELECT 1 FROM "member" WHERE role_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot backfill member.role_id: % member(s) belong to an organization whose existing roles do not include their base role',
      (SELECT count(*) FROM "member" WHERE role_id IS NULL);
  END IF;
END $$;
