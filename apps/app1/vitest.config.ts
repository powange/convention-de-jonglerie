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
        resolve: {
          /**
           * Alias de Nuxt, que ce projet ne reçoit pas autrement — il tourne hors de Nuxt.
           *
           * Sans eux, un utilitaire de `app/` ne pouvait pas importer `~~/shared/...` sous peine
           * de rendre ses tests inexécutables, ce qui poussait à dupliquer le code partagé plutôt
           * qu'à s'y référer.
           */
          alias: {
            '~~': resolve(__dirname),
            '~': resolve(__dirname, 'app'),
          },
        },
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
            // Alias pour #shared (constants partagées entre app et server)
            {
              find: /^#shared\/(.*)$/,
              replacement: resolve(fileURLToPath(new URL('.', import.meta.url)), 'shared') + '/$1',
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
          // 60s pour éviter les flakes setupNuxt en parallèle (le hook init
          // Nuxt peut dépasser 20s sur des fichiers isolés ou en CI chargée)
          hookTimeout: 60000,
          globals: true,
        },
      }),
      /*
       * ⚠️ IL N'Y A PLUS DE PROJET « e2e », et c'est délibéré.
       *
       * Il incluait `test/e2e/**` hors `playwright/`, ce qui ne laissait qu'un seul fichier —
       * `test/e2e/api/auth.test.ts` — dont le `describe` racine était `.skip`. Le contrôle CI
       * `test (e2e)`, l'un des dix-sept exigés, installait l'environnement, préparait Nuxt et
       * passait au vert **sans exécuter une seule assertion**. Un contrôle vert vide est pire
       * qu'absent : il laisse croire que l'API d'authentification est exercée en boîte noire.
       *
       * Ses trois cas sont couverts ailleurs, et mieux : `test/nuxt/server/api/auth/login.test.ts`
       * (mot de passe incorrect, compte Google, compte sans fournisseur), `register.test.ts`
       * (format de l'email) et `request-password-reset.test.ts` — qui vérifie en plus que le
       * message est IDENTIQUE pour un email inexistant, ce que le test désactivé ne faisait pas.
       * Le parcours réel, lui, est joué par Playwright (`public/auth.spec.ts`,
       * `authenticated/login.spec.ts`).
       *
       * `test/e2e/playwright/**` reste en place : ces specs sont lancées par Playwright, pas par
       * Vitest, et n'ont jamais eu besoin de ce projet.
       */
      // Projet 3 : Tests d'intégration (avec base de données)
      {
        test: {
          name: 'integration',
          include: ['test/integration/**/*.db.test.ts'],
          environment: 'node',
          globals: true,
          testTimeout: 30000,
          hookTimeout: 30000,
          pool: 'forks',
          maxWorkers: 1,
          isolate: false,
          sequence: { concurrent: false },
        },
      },
    ],
  },
})
