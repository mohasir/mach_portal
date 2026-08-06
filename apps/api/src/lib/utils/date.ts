// dateStr is a plain calendar date (no time component) — do the arithmetic in UTC so the
// server's local timezone can never shift the result by a day.
export function subtractDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
