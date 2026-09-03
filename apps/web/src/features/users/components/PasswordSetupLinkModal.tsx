'use client';
import { useTranslation } from 'react-i18next';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { PasswordSetupLinkResult } from './PasswordSetupLinkResult';

interface PasswordSetupLinkModalProps {
  url: string | null;
  name: string;
  email: string;
  reason: 'create' | 'reset';
  onClose: () => void;
}

export function PasswordSetupLinkModal({
  url,
  name,
  email,
  reason,
  onClose,
}: PasswordSetupLinkModalProps) {
  const { t: tc } = useTranslation('common');

  return (
    <WrapperModal
      open={!!url}
      onCancel={onClose}
      title={tc('share.action')}
      width={{ xs: '90%', md: 340 }}
      classNames={{ title: 'text-2xl' }}
    >
      {url && <PasswordSetupLinkResult url={url} name={name} email={email} variant={reason} />}
    </WrapperModal>
  );
}
