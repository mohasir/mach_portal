export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  OPERATOR: 'operator',
  MEMBER: 'member',
} as const;

export type RoleType = (typeof ROLES)[keyof typeof ROLES];
export type RoleKeyType = keyof typeof ROLES;
