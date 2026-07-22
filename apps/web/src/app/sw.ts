/// <reference lib="webworker" />
/// <reference types="@serwist/next/typings" />

import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist';
import { NetworkOnly, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

// Auth/session and tRPC traffic must never be cached: session_data lives on
// this origin via the /trpc and /api/auth rewrite proxy (next.config.ts), so
// a cached response could serve stale/wrong-user session or permission data.
// Must stay before ...defaultCache — Serwist matches runtimeCaching entries
// in array order (first match wins), and defaultCache's own same-origin
// NetworkFirst rule (cacheName "others") would otherwise catch /trpc/* GETs.
const authAndRpcRuntimeCaching: RuntimeCaching[] = [
  {
    matcher: ({ sameOrigin, url }) =>
      sameOrigin && (url.pathname.startsWith('/trpc') || url.pathname.startsWith('/api/auth')),
    handler: new NetworkOnly(),
  },
];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [...authAndRpcRuntimeCaching, ...defaultCache],
});

serwist.addEventListeners();
