import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

// Tests unitaires (utils, composables, stores, etc.) sans environnement Nuxt complet
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'happy-dom',
    globals: true,
    testTimeout: 10000,
    setupFiles: ['./tests/setup-common.ts', './tests/setup-mocks.ts'],
    reporters: ['dot'],
    silent: true,
    include: [
      'tests/utils/**/*.test.ts',
      'tests/composables/**/*.test.ts',
      'tests/stores/**/*.test.ts',
      'tests/feedback/**/*.test.ts',
      'tests/**/*.unit.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/e2e/**',
      'tests/integration/**',
      'tests/server/**',
      '**/*.nuxt.test.ts',
      '**/*.db.test.ts',
    ],
  },
})
