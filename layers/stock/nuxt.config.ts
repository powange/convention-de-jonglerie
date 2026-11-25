import { fileURLToPath } from 'node:url'

// Layer « stock » — module gestion du matériel (groupes, items, réservations, planning, listes de
// courses). Partagé entre app1 et Flowvent (lot 3 de docs/flowvent-modules.md).
//
// Ses modules s'importent par l'alias `#stock` (stock-helpers, quantités, prêts…). Ce qui reste
// propre à l'app hôte se résout par `#server` : droits (`canManageStock`,
// `getEditionWithPermissions`), personnes rattachées à l'édition (`personnes-edition`), sélections.
export default defineNuxtConfig({
  alias: {
    '#stock': fileURLToPath(new URL('./', import.meta.url)),
  },
})
