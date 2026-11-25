import { fileURLToPath } from 'node:url'

// Layer « volunteers » — module bénévole modulaire (étape 2).
//
// Les modules propres aux bénévoles vivent ICI et s'importent par l'alias `#volunteers` : services
// des candidatures et des équipes, planificateur, permissions bénévoles, statistiques, créneaux
// récurrents… Ils vivaient dans app1 alors que seul ce layer s'en servait — ce qui empêchait une
// autre app (Flowvent, app2) de l'étendre sans recopier app1. Ce qui reste propre à l'app hôte
// (Prisma, auth, notifications, sélections) se résout toujours par `#server` / `~` / `~~`.
export default defineNuxtConfig({
  alias: {
    '#volunteers': fileURLToPath(new URL('./', import.meta.url)),
  },
})
