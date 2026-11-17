import { z } from 'zod';
import { listQuerySchema } from './pagination';
import { optionalEmail, optionalText } from './fields';

// Derived on read (not a column): `active` if the client has a confirmed/completed
// quote, else `lead`. See docs/mach-bar-domain.md D3.
export const clientStatusSchema = z.enum(['lead', 'active']);
export type ClientStatus = z.infer<typeof clientStatusSchema>;

export const clientsListQuerySchema = listQuerySchema.extend({
  sortBy: z.enum(['name', 'createdAt']).default('createdAt'),
  nameOnly: z.boolean().optional(),
});
export type ClientsListQuery = z.infer<typeof clientsListQuerySchema>;

const clientMutationFields = {
  name: z.string().trim().min(1, 'clients:validation.nameRequired').max(120),
  phone: optionalText(40),
  email: optionalEmail('clients:validation.emailInvalid'),
  address: optionalText(240),
  notes: optionalText(2000),
} as const;

export const createClientSchema = z.object(clientMutationFields);
export const updateClientSchema = z.object(clientMutationFields);

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
