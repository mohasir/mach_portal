'use client';
import { Card, Col, Row, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { ADMIN_MENU, IconMap, type NavItem } from '@/lib/navigation';
import { useLayoutStore } from '@/lib/stores/layout.store';
import { useEffect } from 'react';

const PRIMARY_HREFS = new Set(['/admin', '/admin/calendar', '/admin/quotes']);

export function OptionsPage() {
  const { t } = useTranslation('admin');
  const can = useCan();
  const router = useRouter();

  const setContentBg = useLayoutStore((s) => s.setContentBg);

  useEffect(() => {
    setContentBg('white');
    return () => setContentBg('grey');
  }, [setContentBg]);

  const groups = ADMIN_MENU.map((group, i) => ({
    key: group.group ?? String(i),
    label: group.group,
    items: group.items.filter(
      (item) => item.href && !PRIMARY_HREFS.has(item.href) && (!item.guard || can(item.guard)),
    ),
  })).filter((group) => group.items.length > 0);

  const renderCard = (item: NavItem) => (
    <Col key={item.href} xs={12} sm={8}>
      <Card
        hoverable
        onClick={() => router.push(item.href!)}
        className="bg-olive-faint aspect-square text-center"
        classNames={{ body: 'flex h-full flex-col items-center justify-center gap-2' }}
      >
        {IconMap[item.icon!]}
        <span>{t(item.label)}</span>
      </Card>
    </Col>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="hidden sm:block">
        <PageHeader title={t('nav.options')} />
      </div>

      {/* Mobile: a single flat grid, no group headers. */}
      <Row gutter={[12, 12]} className="sm:hidden">
        {groups.flatMap((group) => group.items).map(renderCard)}
      </Row>

      <div className="hidden sm:flex sm:flex-col sm:gap-6">
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-3">
            {group.label && (
              <Typography.Text className="text-muted">{t(group.label)}</Typography.Text>
            )}
            <Row gutter={[12, 12]}>{group.items.map(renderCard)}</Row>
          </div>
        ))}
      </div>
    </div>
  );
}
