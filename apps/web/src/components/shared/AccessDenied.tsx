'use client';
import { Button, Flex, Result } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { DEFAULT_REDIRECT_HOME } from '@/lib/auth/navigation';

export function AccessDenied() {
  const { t } = useTranslation('auth');
  const router = useRouter();

  const goHome = () => router.replace(DEFAULT_REDIRECT_HOME);

  // A page opened directly (new tab, pasted link) has no previous entry to go back to.
  const goBack = () => (window.history.length > 1 ? router.back() : goHome());

  return (
    <Flex justify="center" align="center" className="min-h-[60vh] p-6">
      <Result
        status="403"
        title={t('denied.title')}
        subTitle={t('denied.subtitle')}
        extra={
          <Flex gap={8} justify="center" wrap>
            <Button icon={<ArrowLeft size={16} />} onClick={goBack}>
              {t('denied.back')}
            </Button>
            <Button type="primary" onClick={goHome}>
              {t('denied.home')}
            </Button>
          </Flex>
        }
      />
    </Flex>
  );
}
