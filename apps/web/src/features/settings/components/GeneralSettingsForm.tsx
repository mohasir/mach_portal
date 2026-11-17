'use client';
import { Feature } from '@/lib/auth/Feature';
import { QuoteDefaultsCard } from './forms/QuoteDefaultsCard';
import { TaxRatesCard } from './forms/TaxRatesCard';
import { QuoteStagesCard } from './forms/QuoteStagesCard';
import { LocationSettingsCard } from './forms/LocationSettingsCard';

export function GeneralSettingsForm() {
  return (
    <div className="flex flex-col gap-6">
      <Feature name="quotes">
        <QuoteDefaultsCard />
      </Feature>
      <TaxRatesCard />
      <Feature name="quotes">
        <LocationSettingsCard />
      </Feature>
      <Feature name="quotes">
        <QuoteStagesCard />
      </Feature>
    </div>
  );
}
