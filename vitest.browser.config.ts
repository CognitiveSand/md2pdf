import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.test.ts', 'tests/browser/browserBackedConversion.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 300_000,
    reporters: ['verbose'],
  },
});
