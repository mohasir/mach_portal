'use client';
import { QuoteDefaultsCard } from './QuoteDefaultsCard';
import { TaxRatesCard } from './TaxRatesCard';
import { QuoteStagesCard } from './QuoteStagesCard';

export function GeneralSettingsForm() {
  return (
    <div className="flex flex-col gap-6">
      <QuoteDefaultsCard />
      <TaxRatesCard />
      <QuoteStagesCard />
    </div>
  );
}
