'use client';
import type { ReactNode } from 'react';
import { Card, Divider, Typography } from 'antd';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';

interface WrapperCardProps {
  title?: ReactNode;
  caption?: ReactNode;
  extra?: ReactNode;
  dividerClassName?: string;
  className?: string;
  children: ReactNode;
  variant?: 'card' | 'plain' | 'outlined';
  showDivider?: boolean;
}

export function WrapperCard({
  title,
  caption,
  extra,
  dividerClassName = 'mt-3 mb-6',
  className,
  children,
  variant = 'card',
  showDivider = false,
}: WrapperCardProps) {
  const isDesktop = useIsDesktop();
  const resolvedVariant = variant ?? (isDesktop ? 'card' : 'plain');

  const content = (
    <>
      {(title || caption || extra) && (
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {title && (
              <Typography.Title className="font-heading text-lg text-brown m-0!">
                {title}
              </Typography.Title>
            )}
            {caption && (
              <Typography.Text type="secondary" className="mt-1 block text-xs">
                {caption}
              </Typography.Text>
            )}
          </div>
          {extra && <div className="shrink-0">{extra}</div>}
        </div>
      )}
      {showDivider && <Divider className={dividerClassName} />}
      {children}
    </>
  );

  if (resolvedVariant === 'plain') {
    return <div className={className}>{content}</div>;
  }

  return (
    <Card className={`${resolvedVariant === 'outlined' ? 'shadow-none' : ''} ${className ?? ''}`}>
      {content}
    </Card>
  );
}
