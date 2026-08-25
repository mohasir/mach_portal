import { user } from '../../db/schema';

export const publicUserColumns = {
  id: user.id,
  name: user.name,
  email: user.email,
  emailVerified: user.emailVerified,
  role: user.role,
  banned: user.banned,
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
  sessionsCount: user.sessionsCount,
  createdAt: user.createdAt,
});

export const userCollectionResource = (users: UserWithSessions[]) => users.map(userResource);

export type UserResource = ReturnType<typeof userResource>;
