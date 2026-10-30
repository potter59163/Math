import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // CLAUDE.md is the agent guide for this repo, so next dev must not generate AGENTS.md.
  agentRules: false,
  // Lets a phone on the same Wi-Fi open the dev server by LAN IP. Dev only; IPs differ by network.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*', '172.*.*.*'],
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
