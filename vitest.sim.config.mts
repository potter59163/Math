import { defineConfig } from 'vitest/config';

// `npm run sim`: the simulated-learner report, kept out of `npm run check` because of how long it runs.
export default defineConfig({
  resolve: {
    alias: { '@': import.meta.dirname },
  },
  test: {
    environment: 'node',
    include: ['lib/sim/report.run.ts'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 0,
    disableConsoleIntercept: true,
    reporters: ['dot'],
  },
});
