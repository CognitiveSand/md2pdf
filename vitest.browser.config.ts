import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts'],
    exclude: ['tests/integration/real-browser-mermaid.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 300_000,
    reporters: ['verbose'],
  },
});
