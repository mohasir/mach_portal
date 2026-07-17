import { ROLES, type RoleType } from '@repo/guards';

export const ROLE_COLORS: Record<RoleType, string> = {
  [ROLES.SUPERADMIN]: 'gold',
  [ROLES.ADMIN]: 'geekblue',
  [ROLES.MANAGER]: 'purple',
  [ROLES.MEMBER]: 'cyan',
};
