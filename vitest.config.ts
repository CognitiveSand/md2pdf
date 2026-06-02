import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/unit/browserLocator.test.ts',
      'tests/unit/driverProvisioner.test.ts',
      'tests/unit/markdownRenderer.test.ts',
      'tests/unit/releaseCatalog.test.ts',
    ],
    exclude: ['tests/browser/**'],
    environment: 'node',
  },
});
