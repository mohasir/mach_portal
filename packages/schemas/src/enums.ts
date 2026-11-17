import { z } from 'zod';

export const paymentMethodSchema = z.enum(['zelle', 'cash', 'card', 'check', 'transfer']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
