/**
 * Les tâches planifiées de Flowvent — le pendant de `apps/app1/server/utils/scheduled-tasks.ts`.
 *
 * Celles du layer bénévoles, et le nettoyage des dépôts temporaires (layers/core) : les autres
 * tâches d'app1 (favoris, billetterie, journal d'erreurs…) servent des modules que Flowvent n'a
 * pas. Mêmes noms, mêmes fréquences qu'app1 : le nom est celui du fichier dans le
 * `server/tasks/` d'un layer, que Nitro enregistre.
 */
export const FUSEAU_DES_TACHES = 'Europe/Paris'

export interface TachePlanifiee {
  /** Nom passé à `runTask`, identique au fichier de `server/tasks/`. */
  name: string
  description: string
  cronExpression: string
}

export const TACHES_PLANIFIEES: TachePlanifiee[] = [
  {
    name: 'volunteer-reminders',
    description: 'Rappelle aux bénévoles leurs créneaux, 30 minutes avant (notification interne)',
    cronExpression: '* * * * *',
  },
  {
    name: 'cleanup-expired-swaps',
    description:
      "Ferme les demandes d'échange de créneau dont l'un des deux créneaux est déjà passé",
    cronExpression: '30 * * * *',
  },
  {
    // Commune à app1 (layers/core/server/tasks/) : les photos de profil déposées mais jamais
    // enregistrées restent dans `temp/` ; effacées après une heure de grâce.
    name: 'cleanup-temp-uploads',
    description:
      "Supprime les photos déposées puis abandonnées dans le dossier temporaire (plus d'une heure)",
    cronExpression: '15 * * * *',
  },
]
