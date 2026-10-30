import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': import.meta.dirname },
  },
  test: {
    environment: 'node',
    include: ['{app,components,lib}/**/*.test.{ts,tsx}'],
    setupFiles: ['./vitest.setup.ts'],
  },
});
