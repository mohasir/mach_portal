'use client';
import { Card, Col, Row, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { ADMIN_MENU, IconMap } from '@/lib/navigation';

const PRIMARY_HREFS = new Set(['/admin', '/admin/calendar', '/admin/events']);

export default function OptionsPage() {
  const { t } = useTranslation('admin');
  const can = useCan();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('nav.options')} />
      {ADMIN_MENU.map((group, i) => {
        const items = group.items.filter(
          (item) =>
            item.href && !PRIMARY_HREFS.has(item.href) && (!item.guard || can(item.guard)),
        );
        if (items.length === 0) return null;
        return (
          <div key={group.group ?? i} className="flex flex-col gap-3">
            {group.group && (
              <Typography.Text className="text-muted">{t(group.group)}</Typography.Text>
            )}
            <Row gutter={[12, 12]}>
              {items.map((item) => (
                <Col key={item.href} xs={12} sm={8}>
                  <Card hoverable onClick={() => router.push(item.href!)} className="text-center">
                    <div className="flex flex-col items-center gap-2">
                      {IconMap[item.icon!]}
                      <span>{t(item.label)}</span>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        );
      })}
    </div>
  );
}
