import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // CLAUDE.md is the agent guide for this repo, so next dev must not generate AGENTS.md.
  agentRules: false,
  // Lets a phone on the same Wi-Fi open the dev server by LAN IP. Dev only; IPs differ by network.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.*.*.*'],
  // A recorded line's name changes with its recording, so a browser can keep the file for good.
  async headers() {
    return [
      {
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
