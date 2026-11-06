export const PG_UNIQUE_VIOLATION = '23505';
export const PG_FOREIGN_KEY_VIOLATION = '23503';

type PgErrorLike = { code?: unknown; constraint_name?: unknown; cause?: unknown };

// Drizzle wraps the driver error, so the Postgres code is looked up along the `cause` chain.
export function isPgError(error: unknown, code: string, constraintIncludes?: string): boolean {
  for (let e = error as PgErrorLike | undefined; e; e = e.cause as PgErrorLike | undefined) {
    if (
      e.code === code &&
      (constraintIncludes === undefined ||
        String(e.constraint_name ?? '').includes(constraintIncludes))
    )
      return true;
  }
  return false;
}
