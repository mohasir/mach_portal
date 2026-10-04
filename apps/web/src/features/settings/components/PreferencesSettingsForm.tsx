'use client';
import { CatalogPreferencesCard } from './forms/CatalogPreferencesCard';
import { PipelinePreferencesCard } from './forms/PipelinePreferencesCard';
import { QuoteBuilderPreferencesCard } from './forms/QuoteBuilderPreferencesCard';

export function PreferencesSettingsForm() {
  return (
    <div className="flex flex-col gap-6">
      <CatalogPreferencesCard />
      <QuoteBuilderPreferencesCard />
      <PipelinePreferencesCard />
    </div>
  );
}
