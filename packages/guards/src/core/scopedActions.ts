import { ACTIONS, RESOURCES } from '../constants/index';

const { READ, CREATE, UPDATE, DELETE } = ACTIONS;

// The (resource, action) pairs the API filters by record owner (created by / assigned to the
// user, through the quote behind each event and payment). An 'own' scope on any other permission
// has no effect, so the role editor only offers own/all here. The API's owner-scope helpers only
// accept these pairs (ScopedCheck) and a test checks every pair is enforced.
export const SCOPED_ACTIONS = {
  [RESOURCES.QUOTE]: [READ, UPDATE, DELETE, ACTIONS.REGENERATE_PDF],
  [RESOURCES.EVENT]: [
    READ,
    UPDATE,
    ACTIONS.RESCHEDULE,
    ACTIONS.MANAGE_STAFF_ASSIGNMENTS,
    ACTIONS.MANAGE_SELECTIONS,
  ],
  [RESOURCES.PAYMENT]: [READ, CREATE, DELETE, ACTIONS.UPLOAD_ATTACHMENT],
} as const;

export type ScopedResource = keyof typeof SCOPED_ACTIONS;
export type ScopedAction<R extends ScopedResource> = (typeof SCOPED_ACTIONS)[R][number];
export type ScopedCheck = {
  [R in ScopedResource]: readonly [resource: R, action: ScopedAction<R>];
}[ScopedResource];

export function supportsScope(resource: string, action: string): boolean {
  if (!Object.hasOwn(SCOPED_ACTIONS, resource)) return false;
  return (SCOPED_ACTIONS[resource as ScopedResource] as readonly string[]).includes(action);
}
