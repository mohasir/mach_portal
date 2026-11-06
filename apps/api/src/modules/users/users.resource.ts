import { member, user } from '../../db/schema';

// `role` is the role inside the tenant (`member.role`); the repository always reads users through
// their membership, so the column is available in every query.
export const publicUserColumns = {
  id: user.id,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified,
  role: member.role,
  banned: user.banned,
  mustChangePassword: user.mustChangePassword,
  createdAt: user.createdAt,
} as const;

export type PublicUser = Pick<typeof user.$inferSelect, keyof typeof publicUserColumns>;

export type UserWithSessions = PublicUser & { sessionsCount: number };

export const userResource = (user: UserWithSessions) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified,
  role: user.role,
  banned: user.banned ?? false,
  mustChangePassword: user.mustChangePassword ?? false,
  sessionsCount: user.sessionsCount,
  createdAt: user.createdAt,
});

export const userCollectionResource = (users: UserWithSessions[]) => users.map(userResource);

export type UserResource = ReturnType<typeof userResource>;
