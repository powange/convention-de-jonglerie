import { fileURLToPath } from 'node:url'

// Layer « map » — la carte du site d'une édition : zones, repères, import d'une carte externe
// (uMap, Google My Maps). Sorti d'app1 pour que Flowvent (app2) l'étende, comme les bénévoles.
//
// Ses modules s'importent par l'alias `#map`. Ce qui reste propre à l'app hôte (Prisma, droits,
// sélections, store d'édition) se résout toujours par `#server` / `~` / `~~`.
export default defineNuxtConfig({
  alias: {
    '#map': fileURLToPath(new URL('./', import.meta.url)),
  },
})
