'use client';
import type { ReactNode } from 'react';
import { Skeleton, Typography } from 'antd';

interface MetricCardProps {
  label: string;
  value: ReactNode;
  bg: string;
  loading?: boolean;
}

export function MetricCard({ label, value, bg, loading }: MetricCardProps) {
  return (
    <div className={`rounded-2xl p-5 ${bg}`}>
      <Typography.Text className="text-muted">{label}</Typography.Text>
      <div className="mt-2">
        {loading ? (
          <Skeleton active title={{ width: 80 }} paragraph={false} />
        ) : (
          <Typography.Title level={2} className="text-brown m-0!">
            {value}
          </Typography.Title>
        )}
      </div>
    </div>
  );
}
