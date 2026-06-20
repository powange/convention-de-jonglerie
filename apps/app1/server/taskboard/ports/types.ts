// Ports du module « gestion des tâches » (layers/tasks). Le layer consomme ces interfaces pour
// résoudre les données propres au domaine (ex. qui peut être assigné à une tâche) sans lire les
// modèles d'autres modules. Même pattern que server/volunteers/ports et server/meals/ports.
// (Dossier `taskboard` et non `tasks` pour ne pas entrer en collision avec le dossier des tâches
// Nitro `server/tasks/`.)

/** Utilisateur assignable à une tâche. */
export interface AssignableUser {
  id: number
  pseudo: string | null
  prenom: string | null
  nom: string | null
  email: string | null
  emailHash: string | null
  profilePicture: string | null
}

/**
 * Annuaire des personnes assignables, propre au domaine. Jonglerie : organisateurs (auteur de
 * convention, créateur d'édition, organisateurs de convention) + bénévoles acceptés. Domaine
 * générique : sa propre résolution (ou la liste vide).
 */
export interface TaskDirectoryPort {
  getAssignableUsers(editionId: number): Promise<AssignableUser[]>
  /**
   * État du module tâches pour un événement (propre au domaine). Jonglerie : existence de l'`Edition`
   * + flag `tasksEnabled`. `found: false` → événement inconnu ; `enabled: false` → module désactivé.
   */
  isTasksEnabled(editionId: number): Promise<{ found: boolean; enabled: boolean }>
}

export interface TaskboardPorts {
  directory: TaskDirectoryPort
}
