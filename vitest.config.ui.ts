import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 10000,
    // Setup avec mocks centralisés
    setupFiles: ['./tests/setup-mocks.ts'],
    // Tests unitaires uniquement
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/integration/**',
      '**/*.nuxt.test.ts',
      '**/*.db.test.ts'
    ],
    // Configuration UI pour Docker
    ui: {
      port: 5173,
      host: '0.0.0.0'
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true
  }
})