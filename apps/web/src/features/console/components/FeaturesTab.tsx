'use client';
import { useState } from 'react';
import { App, Alert, Button, Result, Skeleton, Switch, Tag, Typography } from 'antd';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { FeatureKey } from '@repo/guards';
import { WrapperModal } from '@/components/shared/WrapperModal';
import { getApiErrorCode } from '@/lib/error/apiErrorCode';
import { useLocaleStore } from '@/lib/stores/locale.store';
import {
  activeKeySet,
  buildFeatureSetInput,
  featureToggleState,
  formatFeaturePrice,
  isDependencyErrorCode,
  liveDependentsOf,
  toFeatureFormValues,
  type FeatureFormValues,
} from '../helpers';
import { useConsoleFeatures } from '../hooks/useConsoleFeatures';
import { useSetFeature } from '../hooks/useSetFeature';
import { useUnsetFeature } from '../hooks/useUnsetFeature';
import type { ConsoleFeature } from '../types';
import { ExpiryTag } from './ExpiryTag';
import { FeatureForm } from './FeatureForm';

export function FeaturesTab({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation('console');
  const { t: tc } = useTranslation('common');
  const { t: tApi } = useTranslation('api');
  const { message } = App.useApp();
  const locale = useLocaleStore((s) => s.locale);
  const { data, isPending, isError, refetch, isRefetching } = useConsoleFeatures(organizationId);
  const { setFeature, isPending: isSetting } = useSetFeature();
  const { unsetFeature, isPending: isUnsetting } = useUnsetFeature();
  const [editing, setEditing] = useState<ConsoleFeature | null>(null);
  const [rowErrors, setRowErrors] = useState<Partial<Record<FeatureKey, string>>>({});
  const [formError, setFormError] = useState<string>();

  const featureName = (key: string) => tc(`features.${key}`, { defaultValue: key });
  const dependencyError = (error: unknown) => {
    const code = getApiErrorCode(error);
    return isDependencyErrorCode(code) ? tApi(`errors.${code}`) : undefined;
  };

  if (isError) {
    return (
      <Result
        status="error"
        title={t('featureList.loadError')}
        extra={
          <Button type="primary" loading={isRefetching} onClick={() => void refetch()}>
            {t('detail.retry')}
          </Button>
        }
      />
    );
  }
  if (isPending) return <Skeleton active paragraph={{ rows: 6 }} title={false} />;

  const activeKeys = activeKeySet(data);

  const onToggle = async (feature: ConsoleFeature, next: boolean) => {
    setRowErrors((prev) => ({ ...prev, [feature.key]: undefined }));
    try {
      if (next) await setFeature({ organizationId, key: feature.key });
      else await unsetFeature({ organizationId, key: feature.key });
    } catch (error) {
      const text = dependencyError(error);
      if (text) setRowErrors((prev) => ({ ...prev, [feature.key]: text }));
    }
  };

  const onSubmitTerms = async (feature: ConsoleFeature, values: FeatureFormValues) => {
    const input = buildFeatureSetInput(toFeatureFormValues(feature), values);
    if (Object.keys(input).length === 0) {
      message.info(t('featureForm.unchanged'));
      return;
    }
    setFormError(undefined);
    try {
      await setFeature({ organizationId, key: feature.key, ...input });
      setEditing(null);
    } catch (error) {
      setFormError(dependencyError(error));
    }
  };

  const busy = isSetting || isUnsetting;

  return (
    <>
      <ul className="m-0 flex list-none flex-col p-0">
        {data.map((feature) => {
          const state = featureToggleState(
            feature.key,
            activeKeys,
            liveDependentsOf(feature.key, data, Date.now()),
          );
          const blocked = feature.enabled ? !state.canDisable : !state.canEnable;
          const reasonKeys = feature.enabled ? state.blockedBy : state.missing;
          const reason = blocked
            ? t(feature.enabled ? 'featureList.blockedBy' : 'featureList.requires', {
                features: reasonKeys.map(featureName).join(', '),
              })
            : undefined;
          const name = featureName(feature.key);

          return (
            <li
              key={feature.key}
              className="border-line flex flex-col gap-2 border-b py-3 first:pt-0 last:border-b-0 last:pb-0"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Typography.Text strong>{name}</Typography.Text>
                    <Tag>
                      {t(`featureList.kind.${feature.kind}`, { defaultValue: feature.kind })}
                    </Tag>
                    {feature.enabled && !feature.active && (
                      <Tag color="warning" title={t('featureList.inactiveHint')}>
                        {t('featureList.inactive')}
                      </Tag>
                    )}
                  </div>
                  {feature.enabled && !feature.active && (
                    <Typography.Text type="secondary" className="text-sm">
                      {t('featureList.inactiveHint')}
                    </Typography.Text>
                  )}
                  {reason && (
                    <Typography.Text type="secondary" className="text-sm">
                      {reason}
                    </Typography.Text>
                  )}
                </div>
                <Switch
                  checked={feature.enabled}
                  disabled={blocked || busy}
                  loading={busy}
                  aria-label={t('featureList.switchLabel', { feature: name })}
                  onChange={(next) => void onToggle(feature, next)}
                />
              </div>

              {feature.enabled && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <ExpiryTag expiresAt={feature.expiresAt} />
                    <Typography.Text type="secondary">
                      {feature.priceCents === null
                        ? t('featureList.noPrice')
                        : feature.billingPeriod === 'monthly' || feature.billingPeriod === 'yearly'
                          ? t('featureList.price', {
                              amount: formatFeaturePrice(
                                feature.priceCents,
                                feature.currency,
                                locale,
                              ),
                              period: t(`featureList.period.${feature.billingPeriod}`),
                            })
                          : formatFeaturePrice(feature.priceCents, feature.currency, locale)}
                    </Typography.Text>
                  </div>
                  <Button
                    type="text"
                    size="small"
                    icon={<Pencil size={16} />}
                    aria-label={t('featureList.edit')}
                    onClick={() => {
                      setFormError(undefined);
                      setEditing(feature);
                    }}
                  />
                </div>
              )}

              {rowErrors[feature.key] && (
                <Alert type="error" showIcon title={rowErrors[feature.key]} />
              )}
            </li>
          );
        })}
      </ul>

      <WrapperModal
        open={!!editing}
        onCancel={() => setEditing(null)}
        title={editing ? t('featureForm.title', { feature: featureName(editing.key) }) : undefined}
      >
        {editing && (
          <FeatureForm
            key={editing.key}
            initialValues={toFeatureFormValues(editing)}
            onSubmit={(values) => onSubmitTerms(editing, values)}
            isPending={isSetting}
            errorText={formError}
          />
        )}
      </WrapperModal>
    </>
  );
}
