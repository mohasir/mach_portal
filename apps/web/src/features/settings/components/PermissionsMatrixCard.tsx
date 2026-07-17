'use client';
import { Fragment } from 'react';
import { FaRegSquare, FaSquareCheck } from 'react-icons/fa6';
import { useTranslation } from 'react-i18next';
import {
  ROLES,
  permissionsMatrix,
  rolesPermissionsMatrix,
  type ActionType,
  type ResourceType,
  type RolePermissions,
  type RoleType,
} from '@repo/guards';
import { SettingsCard } from './SettingsCard';

const VISIBLE_ROLES: RoleType[] = [ROLES.MEMBER, ROLES.MANAGER, ROLES.ADMIN];

const permissionsByRole = Object.fromEntries(
  rolesPermissionsMatrix.map(({ role, permissions }) => [role, permissions]),
) as Record<RoleType, RolePermissions>;

function isGranted(role: RoleType, resource: ResourceType, action: ActionType) {
  return !!permissionsByRole[role]?.[resource]?.includes(action);
}

export function PermissionsMatrixCard() {
  const { t } = useTranslation('settings');
  const { t: tu } = useTranslation('users');

  return (
    <SettingsCard title={t('permissions.title')} dividerClassName="mt-3 mb-2">
      <div className="overflow-x-auto">
        <div className="grid min-w-105 grid-cols-[minmax(0,1fr)_repeat(3,3rem)] items-center gap-x-1 gap-y-2 sm:grid-cols-[minmax(0,1fr)_repeat(3,4rem)] sm:gap-x-3">
          <div></div>
          {VISIBLE_ROLES.map((role) => (
            <div key={role} className="text-muted text-center text-sm mt-2 font-medium">
              {tu(`roles.${role}`)}
            </div>
          ))}

          {permissionsMatrix.map(({ resource, actions }) => (
            <Fragment key={resource}>
              <div className="bg-gray-100 col-span-4 mt-3 rounded-md px-3 py-2">
                <div className="text-sm font-semibold">
                  {t(`permissions.resources.${resource}.label`)}
                </div>
                <div className="text-muted text-xs">
                  {t(`permissions.resources.${resource}.caption`)}
                </div>
              </div>

              {actions.map((action) => (
                <Fragment key={`${resource}-${action}`}>
                  <div className="pl-4 text-sm">{t(`permissions.actions.${action}`)}</div>
                  {VISIBLE_ROLES.map((role) => (
                    <div key={role} className="flex justify-center">
                      {isGranted(role, resource, action) ? (
                        <FaSquareCheck size={18} className="text-primary" />
                      ) : (
                        <FaRegSquare size={18} className="text-gray-300" />
                      )}
                    </div>
                  ))}
                </Fragment>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </SettingsCard>
  );
}
