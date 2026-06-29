import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/browser/real-browser-mermaid.test.ts'],
    environment: 'node',
    testTimeout: 90_000,
    hookTimeout: 30_000,
    reporters: ['verbose'],
  },
});
