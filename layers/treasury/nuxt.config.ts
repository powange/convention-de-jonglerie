import { fileURLToPath } from 'node:url'

// Layer « treasury » — trésorerie d'un événement (recettes et dépenses, plan comptable, fonds de
// caisse, avances et remboursements, versements aux artistes). Partagé entre app1 et Flowvent
// (lot 8 de docs/flowvent-modules.md).
//
// Ses modules s'importent par l'alias `#treasury`. Les utilitaires serveur gardent leur adresse
// `#server/utils/…` (chaque app les réexporte) ; ce qui reste propre à l'app hôte — lecture de
// l'édition, organisateurs — passe par le port `#server/treasury/ports/registry`.
export default defineNuxtConfig({
  alias: {
    '#treasury': fileURLToPath(new URL('./', import.meta.url)),
  },
})
