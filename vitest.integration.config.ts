import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 60000,
    hookTimeout: 60000,
    // Configuration pour tests d'intégration avec DB
    setupFiles: ['./tests/setup-db.ts'],
    // Tests d'intégration uniquement
    include: [
      'tests/integration/**/*.test.ts',
      'tests/integration/**/*.db.test.ts'
    ],
    // Configuration pour Prisma
    server: {
      deps: {
        external: ['@prisma/client']
      }
    }
  }
})