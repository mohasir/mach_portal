'use client';
import type { ReactNode } from 'react';
import { Button, Typography } from 'antd';

interface PageHeaderProps {
  title: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function PageHeader({ title, actionLabel, onAction }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Typography.Title level={2} className="font-heading text-brown m-0 min-w-0">
        {title}
      </Typography.Title>
      {actionLabel && onAction && (
        <Button type="primary" onClick={onAction} className="w-full sm:w-auto">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
