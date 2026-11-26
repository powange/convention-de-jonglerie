import { fileURLToPath } from 'node:url'

// Layer « ticketing » — module billetterie (tarifs, options, articles remis, quotas, commandes,
// contrôle des entrées, guichet, statistiques, fournisseurs externes). Partagé entre app1 et
// Flowvent (lot 6 de docs/flowvent-modules.md ; Flowvent n'y propose que HelloAsso).
//
// Ses modules s'importent par l'alias `#ticketing`. Les utilitaires serveur gardent leur adresse
// `#server/utils/…` (chaque app les réexporte) ; ce qui reste propre à l'app hôte — droits,
// ports (server/ticketing/ports), administration — se résout aussi par `#server`.
export default defineNuxtConfig({
  alias: {
    '#ticketing': fileURLToPath(new URL('./', import.meta.url)),
  },
})
