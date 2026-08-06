'use client';
import type { ReactNode } from 'react';
import { Card, Divider, Typography } from 'antd';
import { useIsDesktop } from '@/lib/hooks/useIsDesktop';

interface WrapperCardProps {
  title?: ReactNode;
  caption?: ReactNode;
  dividerClassName?: string;
  className?: string;
  children: ReactNode;
  variant?: 'card' | 'plain';
  showDivider?: boolean;
}

export function WrapperCard({
  title,
  caption,
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
      {title ||
        (caption && (
          <div className="mb-4">
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
        ))}
      {showDivider && <Divider className={dividerClassName} />}
      {children}
    </>
  );

  if (resolvedVariant === 'plain') {
    return <div className={className}>{content}</div>;
  }

  return <Card className={className}>{content}</Card>;
}
