import { pgEnum } from 'drizzle-orm/pg-core';

// Shared domain enums. Reused across clients,
// quotes, events and state_settings.
export const stateEnum = pgEnum('state', ['NY', 'NJ', 'CT']);
