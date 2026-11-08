export { RolesPage } from './components/RolesPage';
export { PermissionMatrix } from './components/PermissionMatrix';
export {
  useRolesList,
  useRole,
  useCreateRole,
  useUpdateRole,
  useDuplicateRole,
  useDeleteRole,
} from './hooks/useRoles';
export type { Role, RoleDetail } from './types';
export type { PermissionValue } from './lib/permissionMatrix';
