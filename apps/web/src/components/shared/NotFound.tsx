'use client';
import { Button, Flex, Result } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';

export function NotFound({ home = '/', fullScreen = false }: { home?: string; fullScreen?: boolean }) {
  const { t } = useTranslation('common');
  const router = useRouter();

  return (
    <Flex justify="center" align="center" className={`${fullScreen ? 'min-h-dvh' : 'min-h-[60vh]'} p-6`}>
      <Result
        status="404"
        title={t('notFound.title')}
        subTitle={t('notFound.subtitle')}
        extra={
          <Button type="primary" onClick={() => router.replace(home)}>
            {t('notFound.home')}
          </Button>
        }
      />
    </Flex>
  );
}
