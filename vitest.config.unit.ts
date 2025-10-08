import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

// Tests unitaires (utils, composables, stores, etc.) sans environnement Nuxt complet
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'happy-dom',
    globals: true,
    testTimeout: 10000,
    setupFiles: ['./test/setup-common.ts', './test/setup-mocks.ts'],
    reporters: ['dot'],
    silent: true,
    include: [
      'test/utils/**/*.test.ts',
      'test/composables/**/*.test.ts',
      'test/stores/**/*.test.ts',
      'test/feedback/**/*.test.ts',
      'test/**/*.unit.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'test/e2e/**',
      'test/integration/**',
      'test/server/**',
      '**/*.nuxt.test.ts',
      '**/*.db.test.ts',
    ],
  },
})
