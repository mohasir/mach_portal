import type { ErrorCode } from './constants';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
    // Only consulted by raw (non-tRPC) routes — tRPC procedures derive their HTTP-ish
    // status from the TRPCError `code` they're wrapped in, never from this field.
    public readonly status: number = 400,
  ) {
    super(message ?? code);
    this.name = 'AppError';
  }
}
