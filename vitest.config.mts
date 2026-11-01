import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': import.meta.dirname },
  },
  test: {
    environment: 'node',
    include: ['{app,components,lib}/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
    // Property tests are CPU-bound, and on a busy machine they pass 5 s with nothing wrong.
    testTimeout: 30_000,
  },
});
