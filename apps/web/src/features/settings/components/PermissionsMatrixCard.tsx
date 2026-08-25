'use client';
import { Fragment } from 'react';
import { Divider } from 'antd';
import { FaRegSquare, FaSquareCheck } from 'react-icons/fa6';
import { useTranslation } from 'react-i18next';
import {
  ROLES,
  RESOURCES,
  permissionsMatrix,
  rolesPermissionsMatrix,
  type ActionType,
  type ResourceType,
  type RolePermissions,
  type RoleType,
} from '@repo/guards';
import { WrapperCard } from '@/components/shared/WrapperCard';

const VISIBLE_ROLES: RoleType[] = [ROLES.MEMBER, ROLES.MANAGER, ROLES.ADMIN];

const CONFIGURATION_RESOURCES = new Set<ResourceType>([
  RESOURCES.TAX_RATES,
  RESOURCES.QUOTE_DEFAULTS,
  RESOURCES.QUOTE_STAGES,
  RESOURCES.CATALOG_PREFERENCES,
  RESOURCES.QUOTE_PDF_TEMPLATE,
  RESOURCES.QUOTE_BUILDER_PREFERENCES,
]);

const permissionsByRole = Object.fromEntries(
  rolesPermissionsMatrix.map(({ role, permissions }) => [role, permissions]),
) as Record<RoleType, RolePermissions>;

function isGranted(role: RoleType, resource: ResourceType, action: ActionType) {
  // Widen to `ActionType[]` first — `resource` isn't a literal here, so TS sees a
  // union of each resource's own narrower action-array type and can't resolve
  // `.includes(action)` directly against it.
  const actions: ActionType[] | undefined = permissionsByRole[role]?.[resource];
  return !!actions?.includes(action);
}

export function PermissionsMatrixCard() {
  const { t } = useTranslation('settings');
  const { t: tu } = useTranslation('users');

  return (
    <WrapperCard title={t('permissions.title')}>
      <div className="overflow-x-auto">
        <div className="grid min-w-105 grid-cols-[minmax(0,1fr)_repeat(3,3rem)] items-center gap-x-1 gap-y-2 sm:grid-cols-[minmax(0,1fr)_repeat(3,4rem)] sm:gap-x-3">
          <div></div>
          {VISIBLE_ROLES.map((role) => (
            <div key={role} className="text-muted text-center text-base mt-2 font-medium">
              {tu(`roles.${role}`)}
            </div>
          ))}

          {permissionsMatrix.map(({ resource, actions }, index) => {
            const isFirstConfigurationResource =
              CONFIGURATION_RESOURCES.has(resource) &&
              !CONFIGURATION_RESOURCES.has(permissionsMatrix[index - 1]?.resource as ResourceType);

            return (
              <Fragment key={resource}>
                {isFirstConfigurationResource && (
                  <div className="col-span-4">
                    <Divider className="mt-6 mb-4" />
                    <div className="mt-4 text-base font-semibold">
                      {t('permissions.groups.configurations')}
                    </div>
                  </div>
                )}

                <div className="bg-gray-100 col-span-4 mt-3 rounded-md px-3 py-2">
                  <div className="text-base font-semibold">
                    {t(`permissions.resources.${resource}.label`)}
                  </div>
                  <div className="text-muted text-xs">
                    {t(`permissions.resources.${resource}.caption`)}
                  </div>
                </div>

                {actions.map((action) => (
                  <Fragment key={`${resource}-${action}`}>
                    <div className="pl-4 text-base">{t(`permissions.actions.${action}`)}</div>
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
            );
          })}
        </div>
      </div>
    </WrapperCard>
  );
}
