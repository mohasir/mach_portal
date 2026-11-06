export type SessionSyncKind = 'tenant-changed' | 'login' | 'logout';
export type SessionSyncMessage = { kind: SessionSyncKind; senderId: string };
export type SyncAction = 'home' | 'login';

const CHANNEL_NAME = 'oravi-cloud:session';
const KINDS: readonly string[] = ['tenant-changed', 'login', 'logout'];

// Distinguishes this tab's own messages from other tabs'; the sender never reacts to itself.
export const TAB_ID: string = Math.random().toString(36).slice(2);

export function parseSyncMessage(data: unknown): SessionSyncMessage | null {
  if (typeof data !== 'object' || data === null) return null;
  const { kind, senderId } = data as Record<string, unknown>;
  if (typeof kind !== 'string' || !KINDS.includes(kind) || typeof senderId !== 'string')
    return null;
  return { kind: kind as SessionSyncKind, senderId };
}

export function actionForMessage(data: unknown, ownId: string): SyncAction | null {
  const message = parseSyncMessage(data);
  if (!message || message.senderId === ownId) return null;
  return message.kind === 'logout' ? 'login' : 'home';
}

// Only a known, different organization counts: null means "none selected yet", not a switch.
export function hasTenantChanged(shownId: string | null, currentId: string | null | undefined) {
  return shownId !== null && !!currentId && shownId !== currentId;
}

export function broadcastSessionChange(kind: SessionSyncKind) {
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage({ kind, senderId: TAB_ID } satisfies SessionSyncMessage);
    channel.close();
  } catch {
    // Cross-tab sync is best-effort.
  }
}

export function subscribeSessionChanges(onAction: (action: SyncAction) => void) {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      const action = actionForMessage(event.data, TAB_ID);
      if (action) onAction(action);
    };
    return () => channel.close();
  } catch {
    return () => {};
  }
}
