import { ROLE_TEMPLATES, ROLES, type RoleType } from '@repo/guards';

export interface RoleIdentity {
  name: string;
  isOwner: boolean;
}

export interface RoleDescription {
  /** Key in the `users` namespace, or null when the stored name is shown as is. */
  labelKey: string | null;
  color: string;
}

const SYSTEM_COLORS: Partial<Record<RoleType, string>> = {
  [ROLES.ADMIN]: 'geekblue',
  [ROLES.OPERATOR]: 'purple',
  [ROLES.MEMBER]: 'cyan',
};

// Roles carry no template key once seeded, so a seeded role is recognised by its untouched seeded
// name. Renaming it turns it into a name the organization chose, shown untranslated.
const SYSTEM_ROLE_BY_NAME = new Map(
  ROLE_TEMPLATES.filter((tpl) => !tpl.isOwner).map((tpl) => [tpl.name, tpl.key] as const),
);

export function describeRole(role: RoleIdentity): RoleDescription {
  if (role.isOwner) return { labelKey: 'roles.owner', color: 'gold' };
  const key = SYSTEM_ROLE_BY_NAME.get(role.name);
  if (!key) return { labelKey: null, color: 'default' };
  return { labelKey: `roles.${key}`, color: SYSTEM_COLORS[key] ?? 'default' };
}

/** `t` must be bound to the `users` namespace. */
export function roleLabel(role: RoleIdentity, t: (key: string) => string): string {
  const { labelKey } = describeRole(role);
  return labelKey ? t(labelKey) : role.name;
}
