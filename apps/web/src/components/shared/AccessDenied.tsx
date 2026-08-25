'use client';
import { Button, Flex, Result } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { DEFAULT_REDIRECT_HOME } from '@/lib/auth/navigation';

export function AccessDenied() {
  const { t } = useTranslation('auth');
  const router = useRouter();

  return (
    <Flex justify="center" align="center" className="min-h-[60vh] p-6">
      <Result
        status="403"
        title={t('denied.title')}
        subTitle={t('denied.subtitle')}
        extra={
          <Button type="primary" onClick={() => router.replace(DEFAULT_REDIRECT_HOME)}>
            {t('denied.home')}
          </Button>
        }
      />
    </Flex>
  );
}
