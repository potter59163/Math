import { defineConfig } from 'vitest/config';

// `npm run voice`: spends ElevenLabs credits, so it stays out of `npm run check`. One topic at a time
// with `npm run voice -- matrix` or `npm run voice -- vector`, which picks that topic's runner by its
// path. `npm run voice:dry` prints what would be spent and records nothing.
export default defineConfig({
  resolve: {
    alias: { '@': import.meta.dirname },
  },
  test: {
    environment: 'node',
    include: ['lib/topics/*/scenes/voice.run.ts'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 0,
    disableConsoleIntercept: true,
    reporters: ['dot'],
  },
});
