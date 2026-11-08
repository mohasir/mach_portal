import { describe, expect, it } from 'vitest';
import { catalogActions, catalogResources } from '@repo/guards';
import esRoles from '@/locales/es/roles.json';
import enRoles from '@/locales/en/roles.json';
import esApi from '@/locales/es/api.json';
import enApi from '@/locales/en/api.json';
import { MATRIX_GROUPS } from '../lib/permissionMatrix';

const ROLE_ERROR_CODES = [
  'ROLE_NOT_FOUND',
  'ROLE_NAME_TAKEN',
  'ROLE_IS_OWNER',
  'ROLE_IN_USE',
  'ROLE_VERSION_CONFLICT',
  'ROLE_PRIVILEGE_ESCALATION',
  'ROLE_LAST_OWNER',
];

describe.each([
  ['es', esRoles, esApi],
  ['en', enRoles, enApi],
])('%s labels', (_locale, roles, api) => {
  const matrix = roles.matrix as {
    groups: Record<string, string>;
    resources: Record<string, { label: string }>;
    actions: Record<string, string>;
  };

  it('label every current catalog resource and action', () => {
    for (const resource of catalogResources()) {
      expect(matrix.resources[resource]?.label, resource).toBeTruthy();
      for (const action of catalogActions(resource)) {
        expect(matrix.actions[action], `${resource}.${action}`).toBeTruthy();
      }
    }
  });

  it('label every matrix group', () => {
    for (const group of MATRIX_GROUPS) expect(matrix.groups[group], group).toBeTruthy();
  });

  it('translate every role error code', () => {
    const errors = api.errors as Record<string, string>;
    for (const code of ROLE_ERROR_CODES) expect(errors[code], code).toBeTruthy();
  });
});
