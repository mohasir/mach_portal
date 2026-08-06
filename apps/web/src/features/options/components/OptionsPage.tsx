'use client';
import { useEffect } from 'react';
import { Card, Col, Row, Typography } from 'antd';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/shared/PageHeader';
import { useCan } from '@/lib/auth/useCan';
import { ADMIN_MENU, IconCardOptionsMap, type NavItem } from '@/lib/navigation';
import { useLayoutStore } from '@/lib/stores/layout.store';

const PRIMARY_HREFS = new Set(['/admin', '/admin/calendar', '/admin/quotes']);

export function OptionsPage() {
  const { t } = useTranslation('admin');
  const can = useCan();
  const router = useRouter();

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
        className="aspect-square text-center"
        classNames={{ body: 'flex h-full flex-col items-center justify-center gap-2' }}
      >
        <div className="flex h-22.5 w-9 items-center justify-center">
          <Image
            src={IconCardOptionsMap[item.icon!]!}
            alt=""
            className="h-full w-full object-contain"
          />
        </div>
        <span className="text-base">{t(item.label)}</span>
      </Card>
    </Col>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="hidden sm:block">
        <PageHeader title={t('nav.options')} />
      </div>

      {/* Mobile: a single flat grid, no group headers. */}
      <Row gutter={[20, 20]} className="sm:hidden">
        {groups.flatMap((group) => group.items).map((item) => renderCard(item))}
      </Row>

      <div className="hidden sm:flex sm:flex-col sm:gap-6">
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-3">
            {group.label && (
              <Typography.Text className="text-muted">{t(group.label)}</Typography.Text>
            )}
            <Row gutter={[20, 20]}>{group.items.map((item) => renderCard(item))}</Row>
          </div>
        ))}
      </div>
    </div>
  );
}
