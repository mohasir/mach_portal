export class InvalidExpiryDateError extends Error {
  constructor(value: string) {
    super(`Invalid expiry date "${value}": use a real date as YYYY-MM-DD.`);
    this.name = 'InvalidExpiryDateError';
  }
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// The given day is the last active one; the stored instant is the start of the following day,
// which is when the feature stops resolving as active.
export function parseExpiryDate(value: string): Date {
  const match = DATE_PATTERN.exec(value);
  if (!match) throw new InvalidExpiryDateError(value);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const lastDay = new Date(Date.UTC(year, month - 1, day));
  if (
    lastDay.getUTCFullYear() !== year ||
    lastDay.getUTCMonth() !== month - 1 ||
    lastDay.getUTCDate() !== day
  ) {
    throw new InvalidExpiryDateError(value);
  }
  return new Date(Date.UTC(year, month - 1, day + 1));
}
