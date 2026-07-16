import { z } from 'zod';

// US states Mach Bar operates in (docs/mach-bar-domain.md §4). Shared across
// client, quote, event and state-settings schemas.
export const stateSchema = z.enum(['NY', 'NJ', 'CT']);
export type StateValue = z.infer<typeof stateSchema>;

export const paymentMethodSchema = z.enum(['zelle', 'cash', 'card', 'check']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
