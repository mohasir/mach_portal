import type { RoleIdentity } from '@/lib/auth/roleLabel';

type RoleOption = { value: string; label: string; disabled?: boolean };

/**
 * Select options for the roles the caller may assign. A member's current role that the caller
 * cannot assign stays listed, disabled, so the field shows its name instead of a bare id; while
 * the assignable roles load it is the only option.
 */
export function toRoleOptions<R extends RoleIdentity & { id: string }>(
  roles: readonly R[] | undefined,
  label: (role: RoleIdentity) => string,
  current?: RoleIdentity & { id: string },
): RoleOption[] {
  if (!roles) return current ? [{ value: current.id, label: label(current) }] : [];
  const options: RoleOption[] = roles.map((role) => ({
    value: role.id,
    label: label(role),
  }));
  if (current && !roles.some((role) => role.id === current.id)) {
    options.push({ value: current.id, label: label(current), disabled: true });
  }
  return options;
}
