'use client';
import { Button, Flex, Tag, Typography } from 'antd';
import { Building2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Organization } from '../types';

export interface OrganizationListProps {
  items: Organization[];
  activeId?: string | null;
  pendingId?: string;
  disabled?: boolean;
  onSelect: (organization: Organization) => void;
}

export function OrganizationList({
  items,
  activeId,
  pendingId,
  disabled,
  onSelect,
}: OrganizationListProps) {
  const { t } = useTranslation('tenant');

  return (
    <Flex vertical gap={8}>
      {items.map((org) => (
        <Button
          key={org.id}
          block
          size="large"
          icon={<Building2 size={18} />}
          loading={pendingId === org.id}
          disabled={disabled && pendingId !== org.id}
          onClick={() => onSelect(org)}
          className="justify-start"
        >
          <Flex align="center" gap={8} className="min-w-0">
            <span className="truncate">{org.name}</span>
            <Typography.Text type="secondary" className="text-small shrink-0">
              {org.slug}
            </Typography.Text>
            {org.id === activeId && <Tag className="m-0 shrink-0">{t('select.current')}</Tag>}
          </Flex>
        </Button>
      ))}
    </Flex>
  );
}
