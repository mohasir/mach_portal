'use client';
import { Col, Row, Typography } from 'antd';
import { ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UpcomingEventsCard } from '@/features/events';
import { useEffect } from 'react';
import { useLayoutStore } from '@/lib/stores/layout.store';

const STATS = [
  { key: 'new', value: 245, delta: '20%', bg: 'bg-olive-faint' },
  { key: 'pending', value: 123, delta: '11%', bg: 'bg-ivory' },
  { key: 'delivered', value: 150, delta: '18%', bg: 'bg-salmon/20' },
] as const;

export default function DashboardPage() {
  const { t } = useTranslation('admin');

  const setContentBg = useLayoutStore((s) => s.setContentBg);

  useEffect(() => {
    setContentBg('white');
    return () => setContentBg('grey');
  }, [setContentBg]);

  return (
    <div>
      <Row gutter={[16, 16]}>
        {STATS.map((s) => (
          <Col xs={24} md={8} key={s.key}>
            <div className={`rounded-2xl p-5 ${s.bg}`}>
              <Typography.Text className="text-muted">
                {t(`dashboard.stats.${s.key}`)}
              </Typography.Text>
              <div className="mt-2 flex items-end gap-3">
                <Typography.Title level={2} className="text-brown m-0!">
                  {s.value}
                </Typography.Title>
                <span className="text-primary flex items-center gap-1 pb-1 text-xs">
                  <ArrowUp size={14} />
                  {s.delta}
                </span>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      <Row className="mt-4">
        <Col xs={24} lg={12}>
          <UpcomingEventsCard />
        </Col>
      </Row>
    </div>
  );
}
