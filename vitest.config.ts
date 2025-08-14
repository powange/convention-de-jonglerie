import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    environmentOptions: {
      nuxt: {
        mock: {
          intersectionObserver: true,
          indexedDb: true,
        }
      }
    },
    // Configuration pour les tests d'intégration avec DB
    setupFiles: ['./tests/setup.ts', './tests/setup-db.ts'],
    // Augmenter le timeout pour les tests avec DB
    testTimeout: 30000,
    hookTimeout: 30000,
    // Configuration pour résoudre les modules Prisma
    server: {
      deps: {
        external: ['@prisma/client']
      }
    }
  },
  build: {
    rollupOptions: {
      external: ['**/*.spec.ts', '**/*.test.ts']
    }
  }

})