import { fileURLToPath } from 'node:url'

// Layer « artists » — module artistes et spectacles (espace artiste, gestion des artistes et des
// spectacles, modèles de spectacle, dépôts de fichiers). Partagé entre app1 et Flowvent (lot 4 de
// docs/flowvent-modules.md).
//
// Ses modules s'importent par l'alias `#artists`. Ce qui reste propre à l'app hôte se résout par
// `#server` : droits, ports (server/artists/ports : informations de l'édition, catalogue des
// repas), messagerie (synchronisation du groupe d'un spectacle), articles remis, repas.
export default defineNuxtConfig({
  alias: {
    '#artists': fileURLToPath(new URL('./', import.meta.url)),
  },
})
