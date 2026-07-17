import type { ReactNode } from 'react';
import { Card, Divider, Typography } from 'antd';

interface SettingsCardProps {
  title: ReactNode;
  caption?: ReactNode;
  dividerClassName?: string;
  className?: string;
  children: ReactNode;
}

export function SettingsCard({
  title,
  caption,
  dividerClassName = 'mt-3 mb-6',
  className,
  children,
}: SettingsCardProps) {
  return (
    <Card className={className}>
      <Typography.Title level={3} className="font-heading text-brown m-0!">
        {title}
      </Typography.Title>
      {caption && (
        <Typography.Text type="secondary" className="mt-1 block text-xs">
          {caption}
        </Typography.Text>
      )}
      <Divider className={dividerClassName} />
      {children}
    </Card>
  );
}
