export const EXPIRING_SOON_DAYS = 30;

export type ExpiryStatus =
  | { state: 'permanent' }
  | { state: 'active'; daysLeft: number }
  | { state: 'expiringSoon'; daysLeft: number }
  | { state: 'expired' };

const DAY_MS = 86_400_000;

export function expiryStatus(expiresAt: Date | null, now: Date): ExpiryStatus {
  if (!expiresAt) return { state: 'permanent' };
  const ms = expiresAt.getTime() - now.getTime();
  if (ms <= 0) return { state: 'expired' };
  const daysLeft = Math.ceil(ms / DAY_MS);
  return { state: daysLeft <= EXPIRING_SOON_DAYS ? 'expiringSoon' : 'active', daysLeft };
}
