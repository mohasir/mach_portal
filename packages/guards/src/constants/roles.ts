export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  MEMBER: 'member',
} as const;

export type RoleType = (typeof ROLES)[keyof typeof ROLES];
export type RoleKeyType = keyof typeof ROLES;
