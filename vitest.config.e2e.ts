import { defineVitestConfig } from '@nuxt/test-utils/config'

// Tests E2E Nuxt (démarre un serveur Nuxt et utilise $fetch)
export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    environmentOptions: {
      nuxt: {
        overrides: {
          server: { port: 3001 },
        },
      },
    },
    setupFiles: ['./test/e2e/setup.ts'],
    testTimeout: 60000,
    hookTimeout: 60000,
    globals: true,
    include: ['test/e2e/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
})
