import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Tutti i file di test condividono lo stesso database di test: niente parallelismo.
    fileParallelism: false,
    globalSetup: ['./test/globalSetup.ts'],
    testTimeout: 15000,
  },
});
