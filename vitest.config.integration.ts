import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    // Configuration pour les tests d'intégration avec DB
    setupFiles: ['./test/setup-common.ts', './test/setup-integration.ts', './test/setup-db.ts'],
    // Augmenter le timeout pour les tests avec DB
    testTimeout: 30000,
    hookTimeout: 30000,
    // Configuration pour résoudre les modules Prisma
    server: {
      deps: {
        external: ['@prisma/client'],
      },
    },
    // Auto-import des fonctions H3/Nitro
    globals: true,
    // Sortie plus concise
    reporters: ['dot'],
    silent: true,
    watch: false,
    // Exécution mono-thread pour éviter les conflits DB (verrous, ordre)
    pool: 'threads',
    poolOptions: { threads: { minThreads: 1, maxThreads: 1 } },
    sequence: { concurrent: false },
    // Inclure seulement les vrais tests d'intégration (avec DB)
    include: ['test/integration/**/*.db.test.ts'],
  },
  build: {
    rollupOptions: {
      external: ['**/*.spec.ts', '**/*.test.ts'],
    },
  },
})
