import type { ErrorCode } from './constants';

export type AppErrorDetails = Readonly<Record<string, string | number | boolean>>;

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message?: string,
    // Only consulted by raw (non-tRPC) routes — tRPC procedures derive their HTTP-ish
    // status from the TRPCError `code` they're wrapped in, never from this field.
    public readonly status: number = 400,
    // Sent to the client as `errorDetails`, so it must never carry anything but safe scalars.
    public readonly details?: AppErrorDetails,
  ) {
    super(message ?? code);
    this.name = 'AppError';
  }
}
