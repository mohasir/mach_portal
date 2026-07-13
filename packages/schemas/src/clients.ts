import { z } from 'zod';
import { listQuerySchema } from './pagination';
import { stateSchema } from './enums';

// Derived on read (not a column): `active` if the client has a confirmed/completed
// quote, else `lead`. See docs/mach-bar-domain.md D3.
export const clientStatusSchema = z.enum(['lead', 'active']);
export type ClientStatus = z.infer<typeof clientStatusSchema>;

export const clientsListQuerySchema = listQuerySchema.extend({
  sortBy: z.enum(['name', 'city', 'state', 'createdAt']).default('createdAt'),
});
export type ClientsListQuery = z.infer<typeof clientsListQuerySchema>;

// Optional free-text field: a blank string means "not provided" (stored null).
const blankToUndefined = (v: unknown) =>
  typeof v === 'string' ? (v.trim() === '' ? undefined : v.trim()) : v;

const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, z.string().max(max).optional());

const clientMutationFields = {
  name: z.string().trim().min(1, 'clients.validation.nameRequired').max(120),
  phone: optionalText(40),
  email: z.preprocess(blankToUndefined, z.email('clients.validation.emailInvalid').optional()),
  city: optionalText(120),
  state: z.preprocess((v) => (v === '' || v === null ? undefined : v), stateSchema.optional()),
  address: optionalText(240),
  notes: optionalText(2000),
} as const;

export const createClientSchema = z.object(clientMutationFields);
export const updateClientSchema = z.object(clientMutationFields);

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
