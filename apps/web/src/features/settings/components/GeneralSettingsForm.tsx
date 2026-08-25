'use client';
import { QuoteDefaultsCard } from './forms/QuoteDefaultsCard';
import { TaxRatesCard } from './forms/TaxRatesCard';
import { QuoteStagesCard } from './forms/QuoteStagesCard';

export function GeneralSettingsForm() {
  return (
    <div className="flex flex-col gap-6">
      <QuoteDefaultsCard />
      <TaxRatesCard />
      <QuoteStagesCard />
    </div>
  );
}
