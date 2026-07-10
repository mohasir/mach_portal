'use client';
import { Flex, Typography } from 'antd';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSession } from '@/lib/auth/client';

const { Title, Paragraph } = Typography;

export function WelcomeScreen() {
  const { t } = useTranslation('admin');
  const { data } = useSession();
  const name = data?.user?.name ?? data?.user?.email ?? '';

  return (
    <Flex vertical align="center" justify="center" className="min-h-[60vh] px-4 text-center">
      <div className="bg-olive-faint flex size-16 items-center justify-center rounded-2xl">
        <Sparkles size={32} className="text-primary" />
      </div>
      <Title level={2} className="font-heading text-brown mt-6 mb-2">
        {name ? t('welcome.titleNamed', { name }) : t('welcome.title')}
      </Title>
      <Paragraph className="text-muted m-0 max-w-md">{t('welcome.subtitle')}</Paragraph>
    </Flex>
  );
}
