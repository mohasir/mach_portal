import { z } from 'zod';
import { isCatalogPermission, supportsScope } from '@repo/guards';

export const permissionScopeSchema = z.enum(['own', 'all']);
export type PermissionScope = z.infer<typeof permissionScopeSchema>;

export const rolePermissionSchema = z
  .object({
    resource: z.string().min(1),
    action: z.string().min(1),
    scope: permissionScopeSchema,
  })
  .refine((p) => isCatalogPermission(p.resource, p.action), {
    message: 'roles.validation.permissionUnknown',
  })
  .refine((p) => p.scope === 'all' || supportsScope(p.resource, p.action), {
    message: 'roles.validation.permissionScopeUnsupported',
  });
export type RolePermissionInput = z.infer<typeof rolePermissionSchema>;

const rolePermissionsSchema = z.array(rolePermissionSchema).superRefine((permissions, ctx) => {
  const seen = new Set<string>();
  permissions.forEach((p, index) => {
    const key = `${p.resource}.${p.action}`;
    if (seen.has(key)) {
      ctx.addIssue({
        code: 'custom',
        path: [index],
        message: 'roles.validation.permissionDuplicated',
      });
    }
    seen.add(key);
  });
});

const roleMutationFields = {
  name: z
    .string()
    .trim()
    .min(1, 'roles.validation.nameRequired')
    .max(60, 'roles.validation.nameTooLong'),
  permissions: rolePermissionsSchema,
} as const;

export const createRoleSchema = z.object(roleMutationFields);

export const updateRoleSchema = z.object({
  id: z.string().min(1),
  expectedVersion: z.number().int().min(1),
  ...roleMutationFields,
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
