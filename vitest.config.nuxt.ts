import { resolve } from 'path'
import { fileURLToPath } from 'url'

import { defineVitestConfig } from '@nuxt/test-utils/config'
import tsconfigPaths from 'vite-tsconfig-paths'

// Tests Nuxt (composants/pages/server routes) avec environnement 'nuxt'
export default defineVitestConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: [
      // Alias Nuxt virtuels nécessaires au runtime de test-utils
      {
        find: /^#app\/(.*)$/,
        replacement: resolve(__dirname, 'node_modules/nuxt/dist/app') + '/$1',
      },
      { find: /^#app$/, replacement: resolve(__dirname, 'node_modules/nuxt/dist/app') },
      { find: /^#build\/(.*)$/, replacement: resolve(__dirname, '.nuxt') + '/$1' },
      { find: /^#build$/, replacement: resolve(__dirname, '.nuxt') },
      // Mock du manifeste d'app Nuxt pour l'analyse des imports (non utilisé réellement en tests)
      {
        find: /^#app-manifest$/,
        replacement: resolve(__dirname, 'tests/__mocks__/app-manifest.ts'),
      },

      // Alias pour contourner les problèmes avec les crochets dans les noms de fichiers
      { find: '@server-editions', replacement: resolve(__dirname, 'server/api/editions/[id]') },
      {
        find: '@server-conventions',
        replacement: resolve(__dirname, 'server/api/conventions/[id]'),
      },
      {
        find: '@server-carpool-offers',
        replacement: resolve(__dirname, 'server/api/carpool-offers/[id]'),
      },
      {
        find: '@server-carpool-requests',
        replacement: resolve(__dirname, 'server/api/carpool-requests/[id]'),
      },

      // Alias regex: tous les imports du type ../../server/... ou ../../../server/... pointent vers /server
      { find: /^(\.\.\/)+server\//, replacement: resolve(__dirname, 'server') + '/' },
      // Alias stable pour les imports commençant par 'server/...'
      { find: /^server\//, replacement: resolve(__dirname, 'server') + '/' },
      // Alias regex pour le mock Prisma depuis différents niveaux: ../../__mocks__/prisma
      {
        find: /^(\.\.\/)+__mocks__\/prisma$/,
        replacement: resolve(__dirname, 'tests/__mocks__/prisma.ts'),
      },
    ],
  },
  test: {
    environment: 'nuxt',
    environmentOptions: {
      nuxt: {
        // S'assure que Nuxt prend la racine du projet
        rootDir: fileURLToPath(new URL('.', import.meta.url)),
        mock: {
          intersectionObserver: true,
          indexedDb: true,
        },
      },
    },
    setupFiles: ['./tests/setup-common.ts', './tests/setup.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    reporters: ['dot'],
    silent: true,
    globals: true,
    include: [
      // Tous les tests Nuxt centralisés ici
      'tests/nuxt/**/*.test.ts',
      // Support des fichiers explicitement suffixés .nuxt.test.ts où qu'ils soient
      'tests/**/*.nuxt.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/e2e/**',
      'tests/integration/**',
      'tests/utils/**',
      'tests/stores/**',
      'tests/feedback/**',
    ],
  },
  build: {
    rollupOptions: { external: ['**/*.spec.ts', '**/*.test.ts'] },
  },
})
