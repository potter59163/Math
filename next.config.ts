import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // CLAUDE.md is the agent guide for this repo, so next dev must not generate AGENTS.md.
  agentRules: false,
  // Lets a phone on the same Wi-Fi open the dev server by LAN IP. Dev only; IPs differ by network.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.*.*.*'],
  async headers() {
    return [
      {
        // No other site may show the app in a frame, so no one can lay a fake page over Settings and
        // have a student press "delete account". The policy names no script or style source, so it
        // leaves Next.js's own inline scripts, KaTeX and the fonts as they were.
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // CLAUDE.md §5: no camera, microphone or location, ever.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // A recorded line's name changes with its recording, so a browser can keep the file for good.
        source: '/voice/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
