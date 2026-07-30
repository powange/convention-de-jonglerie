import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig, devices } from '@playwright/test'

import type { ConfigOptions } from '@nuxt/test-utils/playwright'

const testResultsAuth = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'test-results',
  '.auth'
)

const authFile = path.join(testResultsAuth, 'user.json')
const credentialsFile = path.join(testResultsAuth, 'credentials.json')
const conventionStateFile = path.join(testResultsAuth, 'convention-state.json')

export default defineConfig<ConfigOptions>({
  testDir: './test/e2e/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    nuxt: {
      rootDir: fileURLToPath(new URL('.', import.meta.url)),
      host: 'http://localhost:3000',
    },
  },
  projects: [
    // Setup : crée un compte E2E et sauvegarde la session
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      // 2 minutes : en local, la première visite d'une page compile le serveur de développement
      // — 48 s mesurées sur /login, contre 0 s ensuite. Avec 60 s il ne restait qu'une douzaine
      // de secondes pour la création de compte, et l'étape échouait une fois sur deux. En CI
      // l'application est pré-construite, ce délai n'y change rien.
      timeout: 120000,
      use: { ...devices['Desktop Chrome'], locale: 'fr-FR' },
    },
    // Data setup : crée convention + édition via API
    {
      name: 'data-setup',
      testMatch: /data\.setup\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        locale: 'fr-FR',
        storageState: authFile,
      },
    },
    // Tests publics (sans authentification)
    {
      name: 'public',
      testMatch: /public\//,
      use: { ...devices['Desktop Chrome'], locale: 'fr-FR' },
    },
    // Tests authentifiés (profil, login, convention UI)
    {
      name: 'authenticated',
      testMatch: /authenticated\//,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        locale: 'fr-FR',
        storageState: authFile,
      },
    },
    // Tests de gestion d'édition (dépend du data setup, séquentiel car état partagé)
    {
      name: 'edition-management',
      testMatch: /edition-management\//,
      dependencies: ['data-setup'],
      fullyParallel: false,
      // 2 minutes par test : certains tests font expect.poll(30s) + toPass(60s)
      // pour rendre déterministes les assertions sur la page publique des
      // bénévoles (cf. volunteers.spec.ts). Le défaut 30s coupe avant.
      timeout: 120000,
      use: {
        ...devices['Desktop Chrome'],
        locale: 'fr-FR',
        storageState: authFile,
      },
    },
  ],
})

export { authFile, credentialsFile, conventionStateFile }
