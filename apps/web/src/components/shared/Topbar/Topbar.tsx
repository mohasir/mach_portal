'use client';
import { useEffect, useState } from 'react';
import { Button, Flex, Typography } from 'antd';
import { Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { UserMenu } from '@/components/UserProfile/UserMenu';
import { useDateFormatter } from '@/lib/hooks/useDateFormatter';

export function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const { t } = useTranslation('admin');
  const { date } = useDateFormatter();
  const [today, setToday] = useState('');

  useEffect(() => {
    setToday(date(new Date()));
  }, [date]);

  return (
    <Flex align="center" justify="space-between" gap={16} className="w-full">
      <Flex align="center" gap={12}>
        <Button
          type="text"
          icon={<Menu size={18} />}
          onClick={onToggleSidebar}
          aria-label={t('topbar.toggleMenu')}
        />
        <Flex align="center" gap={8} className="text-muted sm:flex">
          <Typography.Text className="text-muted whitespace-nowrap">{today}</Typography.Text>
        </Flex>
      </Flex>

      <Flex align="center" gap={16}>
        <LanguageSwitcher />
        <UserMenu />
      </Flex>
    </Flex>
  );
}
