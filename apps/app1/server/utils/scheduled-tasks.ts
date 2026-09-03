/**
 * Catalogue des tâches planifiées.
 *
 * **Source unique.** Trois listes se maintenaient à la main — les fichiers de `server/tasks/`, la
 * liste affichée dans l'administration, et la liste blanche d'exécution manuelle — et elles ont
 * divergé : `cleanup-empty-conversations` s'affichait sans pouvoir être lancée (400 « Tâche
 * invalide » relevé en production), et `task-deadlines-reminders` n'apparaissait nulle part alors
 * qu'elle tournait. Les deux points d'API lisent désormais ce tableau.
 *
 * Ce qu'il reste à tenir à jour en ajoutant une tâche : ce catalogue, et le `CronJob` dans
 * `server/plugins/scheduler.ts` qui la déclenche.
 */
export interface TachePlanifiee {
  /** Nom passé à `runTask`, identique au fichier de `server/tasks/`. */
  name: string
  description: string
  schedule: string
  cronExpression: string
  category: 'Notifications' | 'Maintenance'
}

export const TACHES_PLANIFIEES: TachePlanifiee[] = [
  {
    name: 'volunteer-reminders',
    description: 'Envoie des rappels aux bénévoles 30 minutes avant leurs créneaux',
    schedule: 'Chaque minute (vérifie les créneaux dans 30 min)',
    cronExpression: '* * * * *',
    category: 'Notifications',
  },
  {
    name: 'convention-favorites-reminders',
    description: 'Notifie les utilisateurs des conventions favorites qui commencent dans 3 jours',
    schedule: 'Quotidien à 10h',
    cronExpression: '0 10 * * *',
    category: 'Notifications',
  },
  {
    name: 'task-deadlines-reminders',
    description:
      "Rappelle aux assignés les tâches dont l'échéance approche (J-7, J-3, J-1 et le jour même)",
    schedule: 'Quotidien à 9h',
    cronExpression: '0 9 * * *',
    category: 'Notifications',
  },
  {
    name: 'cleanup-expired-tokens',
    description: 'Nettoie les tokens de réinitialisation de mot de passe expirés',
    schedule: 'Quotidien à 2h',
    cronExpression: '0 2 * * *',
    category: 'Maintenance',
  },
  {
    name: 'cleanup-expired-swaps',
    description:
      "Ferme les demandes d'échange de créneau dont l'un des deux créneaux est déjà passé",
    schedule: 'Toutes les heures (à la 30e minute)',
    cronExpression: '30 * * * *',
    category: 'Maintenance',
  },
  {
    name: 'cleanup-temp-uploads',
    description: "Supprime les images abandonnées dans le dossier temporaire (plus d'une heure)",
    schedule: 'Toutes les heures (à la 15e minute)',
    cronExpression: '15 * * * *',
    category: 'Maintenance',
  },
  {
    name: 'cleanup-resolved-error-logs',
    description: "Supprime les logs d'erreur résolus de plus d'un mois",
    schedule: 'Mensuel (1er du mois à 3h)',
    cronExpression: '0 3 1 * *',
    category: 'Maintenance',
  },
  {
    name: 'cleanup-inactive-subscriptions',
    description: 'Nettoie les subscriptions push inactives',
    schedule: 'Quotidien à 4h',
    cronExpression: '0 4 * * *',
    category: 'Maintenance',
  },
  {
    name: 'cleanup-empty-conversations',
    description: 'Supprime les conversations sans messages créées il y a plus de 7 jours',
    schedule: 'Quotidien à 5h',
    cronExpression: '0 5 * * *',
    category: 'Maintenance',
  },
]
