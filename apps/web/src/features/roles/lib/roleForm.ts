import type { AccessGrants } from '@repo/guards';
import type { CreateRoleInput, RolePermissionInput, UpdateRoleInput } from '@repo/schemas';
import {
  diffPermissions,
  exceedingPermissions,
  fromPermissionList,
  toPermissionList,
  type PermissionDiff,
  type PermissionValue,
} from './permissionMatrix';

export interface RoleSource {
  id: string;
  name: string;
  isOwner: boolean;
  version: number;
  permissions: readonly RolePermissionInput[];
}

export interface RoleFormState {
  name: string;
  permissions: PermissionValue;
}

export function initialFormState(role?: Pick<RoleSource, 'name' | 'permissions'>): RoleFormState {
  if (!role) return { name: '', permissions: {} };
  return { name: role.name, permissions: fromPermissionList(role.permissions) };
}

export function buildCreatePayload(state: RoleFormState): CreateRoleInput {
  return { name: state.name.trim(), permissions: toPermissionList(state.permissions) };
}

export function buildUpdatePayload(
  id: string,
  expectedVersion: number,
  state: RoleFormState,
): UpdateRoleInput {
  return { id, expectedVersion, ...buildCreatePayload(state) };
}

function hasChanges(diff: PermissionDiff): boolean {
  return diff.added.length + diff.removed.length + diff.rescoped.length > 0;
}

export function isFormDirty(base: RoleFormState, draft: RoleFormState): boolean {
  return (
    base.name.trim() !== draft.name.trim() ||
    hasChanges(diffPermissions(base.permissions, draft.permissions))
  );
}

export interface RebaseResult {
  draft: RoleFormState;
  expectedVersion: number;
  /** What saving the draft would change on top of the latest version. */
  diff: PermissionDiff & { nameChanged: boolean };
}

// After a version conflict the draft is never replaced: the editor moves to the latest version so
// the user can review the differences and decide whether to save over it or discard their edits.
export function rebaseOnLatest(draft: RoleFormState, latest: RoleSource): RebaseResult {
  const base = initialFormState(latest);
  return {
    draft,
    expectedVersion: latest.version,
    diff: {
      nameChanged: base.name.trim() !== draft.name.trim(),
      ...diffPermissions(base.permissions, draft.permissions),
    },
  };
}

export interface EditorMode {
  locked: boolean;
  /** The role holds permissions wider than the actor's: the API refuses any change to it. */
  exceedsActor: boolean;
  readOnly: boolean;
}

export function editorMode(
  role: Pick<RoleSource, 'isOwner' | 'permissions'>,
  canUpdate: boolean,
  actor: AccessGrants | null | undefined,
): EditorMode {
  if (role.isOwner) return { locked: true, exceedsActor: false, readOnly: true };
  const exceedsActor = exceedingPermissions(fromPermissionList(role.permissions), actor).length > 0;
  return { locked: false, exceedsActor, readOnly: !canUpdate || exceedsActor };
}
