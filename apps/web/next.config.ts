import type { NextConfig } from 'next';

// Server-only: where Next forwards the proxied API paths. Not exposed to the
// browser, so the app is single-origin and auth cookies land on the web origin.
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:8080';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: '/api/auth/:path*', destination: `${API_URL}/api/auth/:path*` },
      { source: '/trpc/:path*', destination: `${API_URL}/trpc/:path*` },
    ];
  },
};

export default nextConfig;
