'use client';
import { App, Radio, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { CATALOG_KINDS, type CatalogKind } from '@repo/schemas';
import { useSetCatalogKind } from '../hooks/useSetCatalogKind';

export function CatalogTab({
  organizationId,
  catalogKind,
}: {
  organizationId: string;
  catalogKind: CatalogKind;
}) {
  const { t } = useTranslation('console');
  const { modal } = App.useApp();
  const { setCatalogKind, isPending } = useSetCatalogKind();

  const onChange = (kind: CatalogKind) => {
    if (kind === catalogKind) return;
    modal.confirm({
      title: t('catalog.confirmTitle'),
      content: t('catalog.confirmContent', { kind: t(`vocabulary:${kind}.Items`) }),
      okText: t('catalog.confirmOk'),
      onOk: () => setCatalogKind({ organizationId, kind }).catch(() => {}),
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <Typography.Title level={5} className="m-0">
          {t('catalog.title')}
        </Typography.Title>
        <Typography.Text type="secondary">{t('catalog.description')}</Typography.Text>
      </div>
      <Radio.Group
        optionType="button"
        buttonStyle="solid"
        disabled={isPending}
        value={catalogKind}
        onChange={(event) => onChange(event.target.value as CatalogKind)}
        aria-label={t('catalog.current')}
        options={CATALOG_KINDS.map((value) => ({
          value,
          label: t(`vocabulary:${value}.Items`),
        }))}
      />
    </div>
  );
}
