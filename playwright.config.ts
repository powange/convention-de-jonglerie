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

export default defineConfig<ConfigOptions>({
  testDir: './test/e2e/playwright',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
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
    // Setup : se connecte et sauvegarde la session
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      timeout: 60000,
      use: { ...devices['Desktop Chrome'], locale: 'fr-FR' },
    },
    // Tests publics (sans authentification)
    {
      name: 'chromium',
      testIgnore: /authenticated\/|auth\.setup\.ts/,
      use: { ...devices['Desktop Chrome'], locale: 'fr-FR' },
    },
    // Tests authentifiés (chargent la session du setup)
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
  ],
})

export { authFile, credentialsFile }
