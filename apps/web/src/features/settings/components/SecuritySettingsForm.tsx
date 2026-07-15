'use client';
import { ActiveSessionsCard } from './ActiveSessionsCard';

export function SecuritySettingsForm() {
  return (
    <div className="flex flex-col gap-6">
      <ActiveSessionsCard />
    </div>
  );
}
