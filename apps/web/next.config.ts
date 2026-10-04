import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

// Server-only: where Next forwards the proxied API paths. Not exposed to the
// browser, so the app is single-origin and auth cookies land on the web origin.
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:8080';

// The pre-push hook builds into its own folder so it never overwrites the `.next` and
// `public/sw.js` a running dev server is using. Unset (dev, Netlify) keeps the defaults.
const distDir = process.env.NEXT_DIST_DIR || '.next';

const pkg = JSON.parse(readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8'));

function getCommitHash(): string {
  if (process.env.RAILWAY_GIT_COMMIT_SHA) return process.env.RAILWAY_GIT_COMMIT_SHA.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

const nextConfig: NextConfig = {
  distDir,
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
    NEXT_PUBLIC_APP_COMMIT: getCommitHash(),
  },
  async rewrites() {
    return [
      { source: '/api/auth/:path*', destination: `${API_URL}/api/auth/:path*` },
      { source: '/trpc/:path*', destination: `${API_URL}/trpc/:path*` },
      { source: '/api/uploads/:path*', destination: `${API_URL}/api/uploads/:path*` },
    ];
  },
};

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: process.env.NEXT_DIST_DIR ? path.join(distDir, 'sw.js') : 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  reloadOnOnline: false,
});

export default withSerwist(nextConfig);
