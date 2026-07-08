'use client';
import { Button, Flex, Typography } from 'antd';

interface PageHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function PageHeader({ title, actionLabel, onAction }: PageHeaderProps) {
  return (
    <Flex justify="space-between" align="center" className="mb-6">
      <Typography.Title level={2} className="font-heading text-brown m-0">
        {title}
      </Typography.Title>
      {actionLabel && onAction && (
        <Button type="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Flex>
  );
}
