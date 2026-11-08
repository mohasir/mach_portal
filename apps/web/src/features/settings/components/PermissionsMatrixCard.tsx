'use client';
import { Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { RoleTag } from '@/components/shared/RoleTag';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { PermissionMatrix } from '@/features/roles';
import { usePermissions } from '@/features/tenant';
import { toEffectivePermissions } from '../permissions';

export function PermissionsMatrixCard() {
  const { t } = useTranslation('settings');
  const { access, role } = usePermissions();
  const { value, locked } = toEffectivePermissions(access);

  return (
    <WrapperCard
      title={t('permissions.title')}
      caption={t('permissions.description')}
      extra={<RoleTag role={role} className="m-0" />}
    >
      {access ? (
        <PermissionMatrix readOnly value={value} locked={locked} actorAccess={access} />
      ) : (
        <Skeleton active paragraph={{ rows: 6 }} />
      )}
    </WrapperCard>
  );
}
