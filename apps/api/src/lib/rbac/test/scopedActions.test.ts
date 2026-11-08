import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ACTIONS, RESOURCES, SCOPED_ACTIONS, permissionKey } from '@repo/guards';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../../modules/${relative}`, import.meta.url)), 'utf8');

const resourceOf = (name: string) => RESOURCES[name as keyof typeof RESOURCES];
const actionOf = (name: string) => ACTIONS[name as keyof typeof ACTIONS];

// The pairs each module passes to its owner-scope helper, read from the source. ownerIdFor's
// ScopeCheck type already rejects pairs missing from SCOPED_ACTIONS at compile time; this test
// covers the other direction: a pair listed there (offered as own/all by the role editor) that no
// procedure actually filters by.
function enforcedPairs(): Set<string> {
  const pairs = new Set<string>();

  // Routers whose helper takes only the action of their own resource.
  const singleResource: [file: string, resource: string][] = [
    ['quotes/quotes.router.ts', RESOURCES.QUOTE],
    ['payments/payments.router.ts', RESOURCES.PAYMENT],
  ];
  for (const [file, resource] of singleResource) {
    for (const [, action] of read(file).matchAll(/ownerScope\(ctx, ACTIONS\.(\w+)\)/g)) {
      pairs.add(permissionKey(resource, actionOf(action!)));
    }
  }

  // eventOwnerId always applies event.read, plus the gate pair it is given.
  const eventScope = read('events/events.scope.ts');
  if (/\[RESOURCES\.EVENT, ACTIONS\.READ\]/.test(eventScope)) {
    pairs.add(permissionKey(RESOURCES.EVENT, ACTIONS.READ));
  }
  for (const file of ['events/events.router.ts', 'events/events.controller.ts']) {
    const calls = read(file).matchAll(
      /(?:ownerScope\(ctx|eventOwnerId\([^,]+,[^,]+), \[RESOURCES\.(\w+), ACTIONS\.(\w+)\]/g,
    );
    for (const [, resource, action] of calls) {
      pairs.add(permissionKey(resourceOf(resource!), actionOf(action!)));
    }
  }
  return pairs;
}

describe('SCOPED_ACTIONS matches the API', () => {
  it('every scoped pair is filtered by owner somewhere, and nothing else is', () => {
    const listed = Object.entries(SCOPED_ACTIONS).flatMap(([resource, actions]) =>
      actions.map((action) => permissionKey(resource, action)),
    );
    expect([...enforcedPairs()].sort()).toEqual(listed.sort());
  });
});
