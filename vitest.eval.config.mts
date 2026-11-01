import { defineConfig } from 'vitest/config';

// `npm run eval:director`: calls the real LLM provider, so it stays out of `npm run check`.
export default defineConfig({
  resolve: {
    alias: { '@': import.meta.dirname },
  },
  test: {
    environment: 'node',
    include: ['lib/director/llm/eval.run.ts'],
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 0,
    disableConsoleIntercept: true,
    reporters: ['dot'],
  },
});
