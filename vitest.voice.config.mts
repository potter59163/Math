import { defineConfig } from 'vitest/config';

// `npm run voice:receipt`: spends ElevenLabs credits, so it stays out of `npm run check`.
export default defineConfig({
  resolve: {
    alias: { '@': import.meta.dirname },
  },
  test: {
    environment: 'node',
    include: ['lib/topics/matrix/scenes/receiptVoice.run.ts'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 0,
    disableConsoleIntercept: true,
    reporters: ['dot'],
  },
});
