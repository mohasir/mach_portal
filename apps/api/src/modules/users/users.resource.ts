import { role, user } from '../../db/schema';

// `role` is the role of the membership in this tenant; the repository always reads users through
// their membership joined to its role, so the columns are available in every query.
export const publicUserColumns = {
  id: user.id,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified,
  role: { id: role.id, name: role.name, isOwner: role.isOwner },
  banned: user.banned,
  mustChangePassword: user.mustChangePassword,
  createdAt: user.createdAt,
} as const;

export type MembershipRole = Pick<typeof role.$inferSelect, 'id' | 'name' | 'isOwner'>;

export type PublicUser = Pick<
  typeof user.$inferSelect,
  Exclude<keyof typeof publicUserColumns, 'role'>
> & { role: MembershipRole };

export type UserWithSessions = PublicUser & { sessionsCount: number };

export const userResource = (row: UserWithSessions) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  emailVerified: row.emailVerified,
  role: { id: row.role.id, name: row.role.name, isOwner: row.role.isOwner },
  banned: row.banned ?? false,
  mustChangePassword: row.mustChangePassword ?? false,
  sessionsCount: row.sessionsCount,
  createdAt: row.createdAt,
});

export const userCollectionResource = (users: UserWithSessions[]) => users.map(userResource);

export type UserResource = ReturnType<typeof userResource>;
