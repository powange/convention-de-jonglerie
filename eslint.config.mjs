// @ts-check
// Config ESLint du monorepo.
//
// Pourquoi à la racine plutôt que dans apps/app1 :
// @nuxt/eslint génère bien des motifs couvrant les layers partagés, mais sous la forme
// `../../layers/<nom>/…`. Ces chemins sortent de la « base path » d'ESLint quand la config vit
// dans apps/app1, et ESLint écarte alors chaque fichier de layer avec un simple warning
// « File ignored because outside of base path ». Résultat : les onze layers n'étaient lintés
// ni en local ni en CI, sans que rien ne le signale.
//
// Deux ajustements sont nécessaires pour linter depuis la racine :
//  1. les motifs générés sont relatifs à apps/app1 → réécrits par rerootPattern() ;
//  2. @nuxt/eslint-config active son support TypeScript via isPackageExists('typescript'),
//     résolu depuis process.cwd(). Depuis la racine il ne trouve rien et supprime tout le bloc
//     @typescript-eslint, ce qui rend fatale la moindre règle @typescript-eslint/*. On force
//     donc la feature au lieu de la laisser dépendre du répertoire courant.
import { options } from './apps/app1/.nuxt/eslint.config.mjs'
import { createConfigForNuxt } from './apps/app1/node_modules/@nuxt/eslint-config/dist/flat.mjs'

const APP_DIR = 'apps/app1'

/**
 * Réécrit un motif généré (relatif à apps/app1) en motif relatif à la racine du monorepo.
 * `../../layers/faq/app/pages/**` → `layers/faq/app/pages/**`
 * `app/pages/**`                  → `apps/app1/app/pages/**`
 * `**\/*.vue`                     → inchangé (motif global)
 */
const rerootPattern = (pattern) => {
  if (typeof pattern !== 'string') return pattern
  if (pattern.startsWith('../../')) return pattern.slice('../../'.length)
  if (pattern.startsWith('**/') || pattern.startsWith('!**/')) return pattern
  if (pattern.startsWith('!')) return `!${APP_DIR}/${pattern.slice(1)}`
  return `${APP_DIR}/${pattern}`
}

// Une entrée de `files` peut être un motif ou un tableau de motifs (sémantique ET).
const rerootEntry = (entry) =>
  Array.isArray(entry) ? entry.map(rerootPattern) : rerootPattern(entry)

/** Applique la réécriture aux `files`/`ignores` de chaque objet de config généré. */
const reroot = (configs) =>
  configs.map((config) => {
    const next = { ...config }
    if (next.files) next.files = next.files.map(rerootEntry)
    if (next.ignores) next.ignores = next.ignores.map(rerootEntry)
    return next
  })

// `options` est déjà résolu (marqueur __resolved) : le spread le conserve, si bien que
// createConfigForNuxt réutilise tel quel — avec TypeScript forcé.
const nuxtConfigs = await createConfigForNuxt({
  ...options,
  features: { ...options.features, typescript: true },
})

export default [
  ...reroot(nuxtConfigs),
  // La 2ᵉ app est un projet Nuxt séparé avec sa propre config → exclue du lint principal.
  // Le client Prisma généré ne doit jamais être linté (ignore explicite : l'intégration
  // gitignore de withNuxt ne couvre pas ce chemin de façon fiable en monorepo).
  { ignores: ['apps/app2/**', `${APP_DIR}/server/generated/**`] },
  // Règles globales légères pour réduire le bruit sans masquer les erreurs importantes
  {
    files: ['**/*.{js,cjs,mjs,ts,tsx,vue}'],
    rules: {
      // Les props par défaut ne sont pas nécessaires en script setup + TS
      'vue/require-default-prop': 'off',
      // Trop verbeux et non bloquant pour le build
      'vue/html-self-closing': 'off',
      // Autoriser variables préfixées par _ à être non utilisées
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Trop strict pour une migration en cours ; préférer améliorer progressivement
      '@typescript-eslint/no-explicit-any': 'off',
      'no-unused-vars': 'off',
      // Style d'import unifié (mode warn pour adoption progressive)
      'import/order': [
        'warn',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
          pathGroups: [
            { pattern: '~/**', group: 'internal', position: 'after' },
            { pattern: '@/**', group: 'internal', position: 'after' },
            { pattern: '#**', group: 'internal', position: 'after' },
          ],
          pathGroupsExcludedImportTypes: ['builtin'],
        },
      ],
      'import/newline-after-import': ['warn', { count: 1 }],
      'import/no-duplicates': 'warn',
    },
  },
  // Tests (Vitest) : relâcher no-explicit-any + règles import/unused
  {
    files: [`${APP_DIR}/test/**/*.{js,ts,tsx,vue}`],
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
    files: [`${APP_DIR}/scripts/**/*.{js,ts,mjs}`],
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  // Pages/layouts des layers : mêmes exceptions que pour le cœur (le preset Nuxt ne couvre que
  // l'app principale). Les noms de pages à un mot (index, list, validate…) sont légitimes.
  {
    files: ['layers/*/app/pages/**/*.vue', 'layers/*/app/layouts/**/*.vue'],
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  },
]
