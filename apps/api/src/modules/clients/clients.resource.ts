import type { ClientStatus } from '@repo/schemas';
import { clients } from '../../db/schema';

export const publicClientColumns = {
  id: clients.id,
  name: clients.name,
  phone: clients.phone,
  email: clients.email,
  city: clients.city,
  state: clients.state,
  address: clients.address,
  notes: clients.notes,
  createdAt: clients.createdAt,
} as const;

export type PublicClient = Pick<typeof clients.$inferSelect, keyof typeof publicClientColumns>;

// `status` is derived (docs/mach-bar-domain.md D3), not a column; the repository
// computes it so the output shape stays stable.
export type ClientWithStatus = PublicClient & { status: ClientStatus };

export const clientResource = (client: ClientWithStatus) => ({
  id: client.id,
  name: client.name,
  phone: client.phone,
  email: client.email,
  city: client.city,
  state: client.state,
  address: client.address,
  notes: client.notes,
  status: client.status,
  createdAt: client.createdAt,
});

export const clientCollectionResource = (rows: ClientWithStatus[]) => rows.map(clientResource);

export type ClientResource = ReturnType<typeof clientResource>;
