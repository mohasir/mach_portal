import { TRPCError } from '@trpc/server';
import { scopeFor, type AccessGrants } from '@repo/guards';
import type { CreateRoleInput, UpdateRoleInput } from '@repo/schemas';
import {
  AppError,
  ErrorCodes,
  isPgError,
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
} from '../../lib/errors';
import { RolesRepository } from './roles.repository';
import {
  roleAuditSnapshot,
  roleResource,
  roleSummaryCollectionResource,
  type PublicRole,
  type RolePermissionRow,
} from './roles.resource';

export type RolesActor = { userId: string; access: AccessGrants };

const NAME_MAX_LENGTH = 60;
const NAME_UNIQUE_CONSTRAINT = 'role_tenant_name_uq';

const notFound = () =>
  new TRPCError({ code: 'NOT_FOUND', cause: new AppError(ErrorCodes.role.NOT_FOUND) });
const nameTaken = () =>
  new TRPCError({ code: 'CONFLICT', cause: new AppError(ErrorCodes.role.NAME_TAKEN) });
const isOwnerRole = () =>
  new TRPCError({ code: 'FORBIDDEN', cause: new AppError(ErrorCodes.role.IS_OWNER) });
const versionConflict = () =>
  new TRPCError({ code: 'CONFLICT', cause: new AppError(ErrorCodes.role.VERSION_CONFLICT) });
const escalation = () =>
  new TRPCError({ code: 'FORBIDDEN', cause: new AppError(ErrorCodes.role.PRIVILEGE_ESCALATION) });
const inUse = (memberCount: number) =>
  new TRPCError({
    code: 'CONFLICT',
    cause: new AppError(ErrorCodes.role.IN_USE, undefined, 409, { memberCount }),
  });

const mapNameTaken = (error: unknown): never => {
  if (isPgError(error, PG_UNIQUE_VIOLATION, NAME_UNIQUE_CONSTRAINT)) throw nameTaken();
  throw error;
};

// A non-owner may only grant or act on permissions inside their own power: every permission must
// be one they hold, at a scope no wider than theirs. Owners are unrestricted.
export function isWithinPower(access: AccessGrants, permissions: readonly RolePermissionRow[]) {
  if (access.isOwner) return true;
  return permissions.every((p) => {
    const held = scopeFor(access, p.resource, p.action);
    return held !== null && !(p.scope === 'all' && held === 'own');
  });
}

export function assertWithinPower(access: AccessGrants, permissions: readonly RolePermissionRow[]) {
  if (!isWithinPower(access, permissions)) throw escalation();
}

// Who may hand a role to a member: owners any role; anyone else only a non-owner role that grants
// nothing beyond their own power.
export function canAssignRole(
  access: AccessGrants,
  target: { isOwner: boolean },
  permissions: readonly RolePermissionRow[],
) {
  if (access.isOwner) return true;
  return !target.isOwner && isWithinPower(access, permissions);
}

// Keeps the copy inside the name length the schema accepts, so it stays editable.
function copyName(source: string, taken: ReadonlySet<string>): string {
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? ' (copy)' : ` (copy ${n})`;
    const base = source.slice(0, NAME_MAX_LENGTH - suffix.length).trimEnd();
    const candidate = `${base}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export class RolesService {
  constructor(
    private repo: RolesRepository,
    private actor: RolesActor,
  ) {}

  // The bound is applied to a role's current permissions too, so a role stronger than the actor
  // cannot be edited, trimmed, copied or deleted by them: removing permissions they do not hold
  // would still be acting on power above their own.
  private assertWithinActorPower(permissions: readonly RolePermissionRow[]) {
    assertWithinPower(this.actor.access, permissions);
  }

  private async lockEditable(repo: RolesRepository, id: string) {
    const current = await repo.findByIdForUpdate(id);
    if (!current) throw notFound();
    if (current.isOwner) throw isOwnerRole();
    const permissions = await repo.findPermissions(id);
    return { ...current, permissions };
  }

  private async detail(repo: RolesRepository, row: PublicRole) {
    const [permissions, memberCount] = await Promise.all([
      repo.findPermissions(row.id),
      repo.countMembers(row.id),
    ]);
    return { ...row, permissions, memberCount };
  }

  async list() {
    return roleSummaryCollectionResource(await this.repo.listSummaries());
  }

  // Only names: assigning a role must not reveal its permissions to someone without role.read.
  async assignable() {
    const [roles, permissions] = await Promise.all([
      this.repo.listOptions(),
      this.actor.access.isOwner ? Promise.resolve([]) : this.repo.findAllPermissions(),
    ]);
    const byRole = new Map<string, RolePermissionRow[]>();
    for (const { roleId, ...p } of permissions)
      byRole.set(roleId, [...(byRole.get(roleId) ?? []), p]);
    return roles
      .filter((r) => canAssignRole(this.actor.access, r, byRole.get(r.id) ?? []))
      .map((r) => ({ id: r.id, name: r.name, isOwner: r.isOwner }));
  }

  async get(id: string) {
    const summary = await this.repo.findSummaryById(id);
    if (!summary) throw notFound();
    const permissions = await this.repo.findPermissions(id);
    return roleResource({ ...summary, permissions });
  }

  async create(input: CreateRoleInput) {
    this.assertWithinActorPower(input.permissions);
    const created = await this.repo
      .inTransaction(async (repo) => {
        const row = await repo.insert(input.name);
        await repo.insertPermissions(row.id, input.permissions);
        const result = await this.detail(repo, row);
        await repo.insertAudit({
          actorUserId: this.actor.userId,
          roleId: row.id,
          action: 'create',
          before: null,
          after: roleAuditSnapshot(result),
        });
        return result;
      })
      .catch(mapNameTaken);
    return roleResource(created);
  }

  async update(id: string, input: Omit<UpdateRoleInput, 'id'>) {
    this.assertWithinActorPower(input.permissions);
    const updated = await this.repo
      .inTransaction(async (repo) => {
        const current = await this.lockEditable(repo, id);
        if (current.version !== input.expectedVersion) throw versionConflict();
        this.assertWithinActorPower(current.permissions);

        const row = await repo.updateVersioned(id, input.expectedVersion, { name: input.name });
        if (!row) throw versionConflict();
        await repo.replacePermissions(id, input.permissions);
        const result = await this.detail(repo, row);
        await repo.insertAudit({
          actorUserId: this.actor.userId,
          roleId: id,
          action: 'update',
          before: roleAuditSnapshot(current),
          after: roleAuditSnapshot(result),
        });
        return result;
      })
      .catch(mapNameTaken);
    return roleResource(updated);
  }

  async duplicate(id: string) {
    const copy = await this.repo
      .inTransaction(async (repo) => {
        const source = await this.lockEditable(repo, id);
        this.assertWithinActorPower(source.permissions);

        const name = copyName(source.name, new Set(await repo.findNames()));
        const row = await repo.insert(name);
        await repo.insertPermissions(row.id, source.permissions);
        const result = await this.detail(repo, row);
        await repo.insertAudit({
          actorUserId: this.actor.userId,
          roleId: row.id,
          action: 'duplicate',
          before: roleAuditSnapshot(source),
          after: roleAuditSnapshot(result),
        });
        return result;
      })
      .catch(mapNameTaken);
    return roleResource(copy);
  }

  async delete(id: string) {
    return this.repo
      .inTransaction(async (repo) => {
        const current = await this.lockEditable(repo, id);
        this.assertWithinActorPower(current.permissions);

        const memberCount = await repo.countMembers(id);
        if (memberCount > 0) throw inUse(memberCount);

        const deleted = await repo.deleteById(id);
        if (!deleted) throw notFound();
        // role_id stays null: the FK would reject the deleted id, and the snapshot keeps it.
        await repo.insertAudit({
          actorUserId: this.actor.userId,
          roleId: null,
          action: 'delete',
          before: roleAuditSnapshot(current),
          after: null,
        });
        return deleted;
      })
      .catch(async (error: unknown) => {
        // A membership committed between the count and the delete trips the RESTRICT FK.
        if (isPgError(error, PG_FOREIGN_KEY_VIOLATION))
          throw inUse(await this.repo.countMembers(id));
        throw error;
      });
  }
}
