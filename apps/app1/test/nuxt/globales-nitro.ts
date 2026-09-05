import type { Mock } from 'vitest'

/**
 * Les helpers h3 que Nitro expose comme globales à l'exécution, typés pour les tests.
 *
 * Les tests les remplacent par des mocks (`global.readBody = vi.fn()`), ce que TypeScript
 * refusait : `.nuxt/types/nitro-imports.d.ts` les déclare en `const`, et une `const` du
 * périmètre global n'est **pas** une propriété de `globalThis`. D'où 969 erreurs TS2339 —
 * près de 40 % de la dette de typage du dépôt — sur des lignes pourtant correctes.
 *
 * Les redéclarer en `var` dans un `declare global` ne marche pas non plus : TypeScript
 * signale alors un conflit de définitions (TS6200) avec le fichier généré par Nitro.
 *
 * D'où ce module : importer `global` depuis ici masque la globale Node dans le fichier de
 * test, sans rien changer à l'exécution — c'est le même objet. Le type d'origine est
 * conservé par l'intersection, donc `global.fetch` ou `global.localStorage` restent typés
 * comme avant.
 */
type GlobalesNitro = {
  createError: Mock
  defineEventHandler: Mock
  getHeader: Mock
  getQuery: Mock
  getRouterParam: Mock
  readBody: Mock
  readValidatedBody: Mock
  setHeader: Mock
  setResponseStatus: Mock
  storeFileLocally: Mock
  useRuntimeConfig: Mock
}

export const global = globalThis as unknown as typeof globalThis & GlobalesNitro
