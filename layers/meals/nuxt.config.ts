import { fileURLToPath } from 'node:url'

// Layer « meals » — module repas (catalogue des repas de l'événement, sélections, validation au
// comptoir, listes). Partagé entre app1 et Flowvent (lot 7 de docs/flowvent-modules.md).
//
// Ses modules s'importent par l'alias `#meals`. Les ports (`#server/meals/ports/registry`) ont leur
// implémentation commune dans ce layer : elle ne lit que des modèles que les deux apps partagent
// (artistes, billetterie, repas). Les utilitaires serveur gardent leur adresse `#server/utils/…`.
export default defineNuxtConfig({
  alias: {
    '#meals': fileURLToPath(new URL('./', import.meta.url)),
  },
})
