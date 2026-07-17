import { z } from 'zod';

export const stateSchema = z.enum(['NY', 'NJ', 'CT']);
export type StateValue = z.infer<typeof stateSchema>;

export const STATE_NAMES: Record<StateValue, string> = {
  NY: 'New York',
  NJ: 'New Jersey',
  CT: 'Connecticut',
};

export const paymentMethodSchema = z.enum(['zelle', 'cash', 'card', 'check']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
