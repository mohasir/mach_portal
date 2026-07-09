export const ROLES = {
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;

export type RoleType = (typeof ROLES)[keyof typeof ROLES];
export type RoleKeyType = keyof typeof ROLES;
