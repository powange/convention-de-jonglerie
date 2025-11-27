// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

// Étend la config Nuxt (flat config ESLint v9) avec quelques overrides pragmatiques
export default withNuxt(
  // Règles globales légères pour réduire le bruit sans masquer les erreurs importantes
  {
    files: ['**/*.{js,cjs,mjs,ts,tsx,vue}'],
    rules: {
      // Les props par défaut ne sont pas nécessaires en script setup + TS
      'vue/require-default-prop': 'off',
      // Trop verbeux et non bloquant pour le build
      'vue/html-self-closing': 'off',
      // Autoriser variables préfixées par _ à être non utilisées
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Trop strict pour une migration en cours ; préférer améliorer progressivement
      '@typescript-eslint/no-explicit-any': 'off',
      'no-unused-vars': 'off',
      // Style d'import unifié (mode warn pour adoption progressive)
      'import/order': ['warn', {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
        pathGroups: [
          { pattern: '~/**', group: 'internal', position: 'after' },
          { pattern: '@/**', group: 'internal', position: 'after' },
          { pattern: '#**', group: 'internal', position: 'after' }
        ],
        pathGroupsExcludedImportTypes: ['builtin']
      }],
      'import/newline-after-import': ['warn', { count: 1 }],
      'import/no-duplicates': 'warn'
    },
  },
  // Tests (Vitest) : relâcher no-explicit-any + règles import/unused
  {
    files: ['test/**/*.{js,ts,tsx,vue}'],
    languageOptions: {
      globals: {
        // Vitest
        vi: true,
        describe: true,
        it: true,
        expect: true,
        beforeAll: true,
        beforeEach: true,
        afterAll: true,
        afterEach: true,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'import/first': 'off',
      'import/no-mutable-exports': 'off',
      'no-useless-escape': 'off',
      'import/order': 'off',
      'import/newline-after-import': 'off',
    },
  },
  // Scripts utilitaires Node
  {
    files: ['scripts/**/*.{js,ts,mjs}'],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  }
)
