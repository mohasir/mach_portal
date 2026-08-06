'use client';
import { Flex, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Product } from '@/features/catalog';
import { useConfig } from '@/features/settings';
import { useQuoteBuilder } from '../../hooks/useQuoteBuilder';
import { LineBuilder } from './LineBuilder';
import { QuickLineBuilder } from './QuickLineBuilder';

interface LinesBuilderSectionProps {
  catalog: Product[];
  readOnly?: boolean;
}

// Flow A (default): QuickLineBuilder, stations only, no option picking.
// Flow B (opt-in, gated globally by appSettings.allowSelectOptionsAtQuote): LineBuilder, the
// original per-station option picker. The toggle only controls which builder is shown to add
// selections; a quote that already has `selectOptionsAtQuote: true` saved keeps showing
// LineBuilder even if the global preference is later turned off.
export function LinesBuilderSection({ catalog, readOnly }: LinesBuilderSectionProps) {
  const { t } = useTranslation('quotes');
  const { state, setFields } = useQuoteBuilder();
  const { data: config } = useConfig();
  const allowToggle = !!config?.appSettings.allowSelectOptionsAtQuote;

  return (
    <div className="flex flex-col gap-3">
      {allowToggle && (
        <Flex justify="space-between" align="start" gap={16}>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span>{t('builder.selectionsMode.label')}</span>
            <span className="text-xs font-normal text-gray-500">
              {t('builder.selectionsMode.hint')}
            </span>
          </span>
          <Switch
            checked={state.selectOptionsAtQuote}
            disabled={readOnly}
            onChange={(checked) => setFields({ selectOptionsAtQuote: checked })}
          />
        </Flex>
      )}
      {state.selectOptionsAtQuote ? (
        <LineBuilder catalog={catalog} readOnly={readOnly} />
      ) : (
        <QuickLineBuilder catalog={catalog} readOnly={readOnly} />
      )}
    </div>
  );
}
