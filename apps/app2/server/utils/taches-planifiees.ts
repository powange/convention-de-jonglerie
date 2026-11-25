/**
 * Les tâches planifiées de Flowvent — le pendant de `apps/app1/server/utils/scheduled-tasks.ts`.
 *
 * Seules celles du layer bénévoles : les autres tâches d'app1 (favoris, billetterie, journal
 * d'erreurs…) servent des modules que Flowvent n'a pas. Mêmes noms, mêmes fréquences qu'app1 :
 * le nom est celui du fichier dans `layers/volunteers/server/tasks/`, que Nitro enregistre.
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
]
