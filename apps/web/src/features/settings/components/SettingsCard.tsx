'use client';
import type { ReactNode } from 'react';
import { Card, Divider, Typography } from 'antd';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';

interface SettingsCardProps {
  title: ReactNode;
  caption?: ReactNode;
  dividerClassName?: string;
  className?: string;
  children: ReactNode;
  variant?: 'card' | 'plain';
}

export function SettingsCard({
  title,
  caption,
  dividerClassName = 'mt-3 mb-6',
  className,
  children,
  variant,
}: SettingsCardProps) {
  const isDesktop = useIsDesktop();
  const resolvedVariant = variant ?? (isDesktop ? 'card' : 'plain');

  const content = (
    <>
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
    </>
  );

  if (resolvedVariant === 'plain') {
    return <div className={className}>{content}</div>;
  }

  return <Card className={className}>{content}</Card>;
}
