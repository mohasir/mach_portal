'use client';
import { Badge, Button, Empty, Popover, Typography } from 'antd';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function NotificationMenu() {
  const { t } = useTranslation('admin');

  const content = (
    <div className="w-64">
      <Typography.Text strong className="text-brown">
        {t('topbar.notifications')}
      </Typography.Text>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={t('topbar.noNotifications')}
        className="my-4"
      />
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomRight">
      <Badge dot offset={[-7, 7]}>
        <Button type="text" shape="circle" icon={<Bell size={18} />} />
      </Badge>
    </Popover>
  );
}
