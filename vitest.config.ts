import { resolve } from 'path'
import { fileURLToPath } from 'url'

import { defineVitestProject } from '@nuxt/test-utils/config'
import vue from '@vitejs/plugin-vue'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

/**
 * Configuration Vitest avec projets multiples
 * Basée sur: https://nuxt.com/docs/4.x/getting-started/testing
 *
 * Cette configuration permet de gérer plusieurs types de tests dans un seul fichier :
 * - Projet "unit" : Tests unitaires (composants Vue isolés, utilitaires)
 * - Projet "nuxt" : Tests nécessitant l'environnement Nuxt complet
 * - Projet "e2e" : Tests end-to-end avec serveur Nuxt
 * - Projet "integration" : Tests d'intégration avec base de données
 *
 * Commandes :
 * - npm test                           → Lance tous les projets
 * - npx vitest --project unit          → Lance uniquement les tests unitaires
 * - npx vitest --project nuxt          → Lance uniquement les tests Nuxt
 * - npx vitest --project e2e           → Lance uniquement les tests e2e
 * - npx vitest --project integration   → Lance uniquement les tests d'intégration
 */
export default defineConfig({
  plugins: [vue()],
  test: {
    projects: [
      // Projet 1 : Tests unitaires (Node environment)
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.{test,spec}.ts'],
          environment: 'happy-dom',
          globals: true,
        },
      },
      // Projet 2 : Tests Nuxt (environnement Nuxt complet)
      await defineVitestProject({
        plugins: [tsconfigPaths()],
        resolve: {
          alias: [
            // Mock Firebase modules pour les tests
            {
              find: 'firebase/app',
              replacement: resolve(
                fileURLToPath(new URL('.', import.meta.url)),
                'test/__mocks__/firebase-app.ts'
              ),
            },
            {
              find: 'firebase/messaging',
              replacement: resolve(
                fileURLToPath(new URL('.', import.meta.url)),
                'test/__mocks__/firebase-messaging.ts'
              ),
            },
            {
              find: 'firebase-admin',
              replacement: resolve(
                fileURLToPath(new URL('.', import.meta.url)),
                'test/__mocks__/firebase-admin.ts'
              ),
            },
            {
              find: /^#app\/(.*)$/,
              replacement:
                resolve(
                  fileURLToPath(new URL('.', import.meta.url)),
                  'node_modules/nuxt/dist/app'
                ) + '/$1',
            },
            {
              find: /^#app$/,
              replacement: resolve(
                fileURLToPath(new URL('.', import.meta.url)),
                'node_modules/nuxt/dist/app'
              ),
            },
            {
              find: /^#build\/(.*)$/,
              replacement: resolve(fileURLToPath(new URL('.', import.meta.url)), '.nuxt') + '/$1',
            },
            {
              find: /^#build$/,
              replacement: resolve(fileURLToPath(new URL('.', import.meta.url)), '.nuxt'),
            },
            {
              find: /^#app-manifest$/,
              replacement: resolve(
                fileURLToPath(new URL('.', import.meta.url)),
                'test/__mocks__/app-manifest.ts'
              ),
            },
          ],
        },
        test: {
          name: 'nuxt',
          include: ['test/nuxt/**/*.{test,spec}.ts'],
          environment: 'nuxt',
          environmentOptions: {
            nuxt: {
              rootDir: fileURLToPath(new URL('.', import.meta.url)),
              mock: {
                intersectionObserver: true,
                indexedDb: true,
              },
            },
          },
          setupFiles: ['./test/setup-common.ts', './test/setup.ts'],
          testTimeout: 20000,
          hookTimeout: 20000,
          globals: true,
        },
      }),
      // Projet 3 : Tests E2E (serveur Nuxt démarré)
      await defineVitestProject({
        test: {
          name: 'e2e',
          include: ['test/e2e/**/*.{test,spec}.ts'],
          environment: 'nuxt',
          globals: true,
          testTimeout: 60000,
          hookTimeout: 60000,
        },
      }),
      // Projet 4 : Tests d'intégration (avec base de données)
      {
        test: {
          name: 'integration',
          include: ['test/integration/**/*.db.test.ts'],
          environment: 'node',
          globals: true,
          testTimeout: 30000,
          hookTimeout: 30000,
          pool: 'threads',
          poolOptions: { threads: { singleThread: true } },
          sequence: { concurrent: false },
        },
      },
    ],
  },
})
