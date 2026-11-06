'use client';
import { Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { WrapperAlert } from '@/components/shared/WrapperAlert';

interface ExistingAccountAddedResultProps {
  email: string;
  onClose: () => void;
}

export function ExistingAccountAddedResult({ email, onClose }: ExistingAccountAddedResultProps) {
  const { t } = useTranslation('users');
  const { t: tc } = useTranslation('common');

  return (
    <div className="mt-6 flex flex-col gap-6">
      <WrapperAlert
        type="info"
        closeable={false}
        title={t('existingAccount.title')}
        description={t('existingAccount.description', { email })}
      />
      <Button type="primary" block onClick={onClose}>
        {tc('close')}
      </Button>
    </div>
  );
}
