import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 10000,
    // Setup avec mocks centralisés
    setupFiles: ['./test/setup-mocks.ts'],
    // Tests unitaires uniquement
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/integration/**',
      '**/*.nuxt.test.ts',
      '**/*.db.test.ts',
    ],
  },
})
