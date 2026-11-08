'use client';
import { useMemo } from 'react';
import { Checkbox, Collapse, Grid, Segmented, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import type { AccessGrants } from '@repo/guards';
import type { PermissionScope } from '@repo/schemas';
import {
  buildMatrix,
  cellState,
  changeScope,
  resourceState,
  togglePermission,
  toggleResource,
  type MatrixResource,
  type PermissionValue,
} from '../lib/permissionMatrix';

interface PermissionMatrixProps {
  value?: PermissionValue;
  onChange?: (value: PermissionValue) => void;
  actorAccess: AccessGrants | null | undefined;
  /** Owner role: every permission shown granted and nothing editable. */
  locked?: boolean;
  /** Shows the granted permissions without letting anything change. */
  readOnly?: boolean;
}

export function PermissionMatrix({
  value = {},
  onChange,
  actorAccess,
  locked = false,
  readOnly = false,
}: PermissionMatrixProps) {
  const { t } = useTranslation('roles');
  const screens = Grid.useBreakpoint();
  const groups = useMemo(() => buildMatrix(), []);
  // Without an actor every cell is disabled, which is exactly the read-only view.
  const actor = readOnly ? null : actorAccess;

  const resourceLabel = (resource: string) =>
    t(`matrix.resources.${resource}.label`, { defaultValue: resource });
  const resourceCaption = (resource: string) =>
    t(`matrix.resources.${resource}.caption`, { defaultValue: '' });
  const actionLabel = (resource: string, action: string) =>
    t(`matrix.resources.${resource}.actions.${action}`, {
      defaultValue: t(`matrix.actions.${action}`, { defaultValue: action }),
    });

  const emit = (next: PermissionValue) => {
    if (next !== value) onChange?.(next);
  };

  const renderSelectAll = ({ resource, actions }: MatrixResource) => {
    const names = actions.map((a) => a.action);
    const state = resourceState(value, actor, locked, resource, names);
    return (
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <Tag className="m-0">
          {t('matrix.granted', { granted: state.granted, total: state.total })}
        </Tag>
        <Checkbox
          checked={state.checked}
          indeterminate={state.indeterminate}
          disabled={state.disabled}
          onChange={(e) => emit(toggleResource(value, actor, resource, names, e.target.checked))}
        >
          {t('matrix.selectAll')}
        </Checkbox>
      </div>
    );
  };

  const renderActions = ({ resource, actions }: MatrixResource) => (
    <ul className="m-0 flex list-none flex-col gap-2 p-0 md:grid md:grid-cols-2 md:gap-x-6 xl:grid-cols-3">
      {actions.map(({ action, key, scoped }) => {
        const cell = cellState(value, actor, locked, resource, action);
        return (
          <li key={key} className="flex min-h-8 flex-wrap items-center justify-between gap-2">
            <Checkbox
              checked={cell.checked}
              disabled={cell.disabled}
              onChange={(e) =>
                emit(togglePermission(value, actor, resource, action, e.target.checked))
              }
            >
              {actionLabel(resource, action)}
            </Checkbox>
            {scoped && cell.checked && (
              <Segmented<PermissionScope>
                size="small"
                aria-label={t('matrix.scope.label')}
                value={cell.scope ?? 'all'}
                disabled={cell.disabled}
                onChange={(scope) => emit(changeScope(value, actor, resource, action, scope))}
                options={[
                  { value: 'own', label: t('matrix.scope.own') },
                  { value: 'all', label: t('matrix.scope.all'), disabled: cell.allScopeDisabled },
                ]}
              />
            )}
          </li>
        );
      })}
    </ul>
  );

  const renderCaption = (resource: string) =>
    resourceCaption(resource) ? (
      <Typography.Text type="secondary" className="block text-xs">
        {resourceCaption(resource)}
      </Typography.Text>
    ) : null;

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <section key={group.key} className="flex flex-col gap-2">
          <Typography.Text className="text-muted font-medium">
            {t(`matrix.groups.${group.key}`)}
          </Typography.Text>

          {screens.md ? (
            <div className="flex flex-col gap-3">
              {group.resources.map((entry) => (
                <div key={entry.resource} className="border-line rounded-xl border p-4">
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Typography.Text strong>{resourceLabel(entry.resource)}</Typography.Text>
                      {renderCaption(entry.resource)}
                    </div>
                    {renderSelectAll(entry)}
                  </div>
                  {renderActions(entry)}
                </div>
              ))}
            </div>
          ) : (
            <Collapse
              accordion
              size="small"
              items={group.resources.map((entry) => ({
                key: entry.resource,
                label: <Typography.Text strong>{resourceLabel(entry.resource)}</Typography.Text>,
                extra: renderSelectAll(entry),
                children: (
                  <div className="flex flex-col gap-3">
                    {renderCaption(entry.resource)}
                    {renderActions(entry)}
                  </div>
                ),
              }))}
            />
          )}
        </section>
      ))}
    </div>
  );
}
