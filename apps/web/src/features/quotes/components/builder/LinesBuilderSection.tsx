'use client';
import { Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { ACTIONS, RESOURCES } from '@repo/guards';
import type { Product } from '@/features/catalog';
import { SwitchRow } from '@/components/shared/Inputs/SwitchRow';
import { WrapperCard } from '@/components/shared/WrapperCard';
import { useCan } from '@/lib/auth/useCan';
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
  const can = useCan();
  const canEditPricing = can({ [RESOURCES.QUOTE]: [ACTIONS.MANAGE_LINE_PRICING] });
  const allowToggle = !!config?.appSettings.allowSelectOptionsAtQuote;
  const title = `${t('builder.lines.title')}${state.lines.length > 0 ? ` (${state.lines.length})` : ''}`;

  return (
    <WrapperCard title={title}>
      <div className="flex flex-col gap-3">
        {allowToggle && (
          <SwitchRow
            title={t('builder.selectionsMode.label')}
            caption={t('builder.selectionsMode.hint')}
            control={
              <Switch
                checked={state.selectOptionsAtQuote}
                disabled={readOnly}
                onChange={(checked) => setFields({ selectOptionsAtQuote: checked })}
              />
            }
          />
        )}
        {state.selectOptionsAtQuote ? (
          <LineBuilder catalog={catalog} readOnly={readOnly} canEditPricing={canEditPricing} />
        ) : (
          <QuickLineBuilder catalog={catalog} readOnly={readOnly} canEditPricing={canEditPricing} />
        )}
      </div>
    </WrapperCard>
  );
}
