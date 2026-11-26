import { fileURLToPath } from 'node:url'

// Layer « backup » — sauvegarde et restauration de la base (et des fichiers déposés) depuis
// l'administration. Partagé entre app1 et Flowvent : points d'API `/api/admin/backup/*`, suivi de
// la restauration, recherche d'une valeur dans les sauvegardes, et le corps de la page
// (`AdminGestionDesSauvegardes`) — chaque app l'habille de sa propre navigation d'administration.
//
// Ses modules s'importent par l'alias `#backup`. Les utilitaires serveur gardent leur adresse
// `#server/utils/backup-*` (chaque app les réexporte).
export default defineNuxtConfig({
  alias: {
    '#backup': fileURLToPath(new URL('./', import.meta.url)),
  },
  runtimeConfig: {
    sauvegarde: {
      // Début du nom des archives (`<prefixe>-<environnement>-backup-<date>.tar.gz`) : il dit de
      // quel site vient une sauvegarde. Chaque app le fixe dans sa configuration.
      prefixe: 'sauvegarde',
    },
  },
})
