/**
 * Les paliers de rappel d'échéance des tâches.
 *
 * Isolés du reste — ni Prisma, ni notification — parce que c'est ici que se décide *quand* un
 * rappel part, et que cette décision se teste sans base de données.
 */

/** Un palier, du plus lointain au jour même. */
export type TaskDeadlineKind = 'J_MINUS_7' | 'J_MINUS_3' | 'J_MINUS_1' | 'J'

/**
 * Jours pleins avant l'échéance déclenchant un rappel, décroissants.
 *
 * Les jours intermédiaires — J-6 à J-4, J-2 — n'envoient rien : ils seront couverts par le palier
 * suivant. Notifier chaque jour transformerait le rappel en bruit, et un rappel qu'on ignore ne
 * sert plus à rien.
 */
export const PALIERS = [7, 3, 1, 0] as const

const KIND_PAR_PALIER: Record<(typeof PALIERS)[number], TaskDeadlineKind> = {
  7: 'J_MINUS_7',
  3: 'J_MINUS_3',
  1: 'J_MINUS_1',
  0: 'J',
}

/** Le `notificationType` d'un palier — il sert aussi de clé de déduplication. */
export function typeDeNotification(kind: TaskDeadlineKind): string {
  return `task_deadline_reminder_${kind.toLowerCase()}`
}

export const TYPES_DE_RAPPEL = PALIERS.map((p) => typeDeNotification(KIND_PAR_PALIER[p]))

/**
 * Nombre de jours PLEINS entre le début de la journée courante et l'échéance.
 *
 * L'heure de l'échéance est sans effet : une échéance demain à 8 h et une autre demain à 23 h
 * sont toutes deux « J-1 ». Compter en heures aurait fait dépendre le palier de l'heure à
 * laquelle le cron tourne — la même tâche aurait basculé de J-1 à J selon un décalage de cron.
 *
 * Le calcul repasse par des dates locales à minuit plutôt que de diviser un écart de
 * millisecondes : les changements d'heure font des journées de 23 et 25 heures, qu'une division
 * brute décalerait d'un jour.
 */
export function joursAvant(echeance: Date, debutDeJournee: Date): number {
  const jourEcheance = new Date(
    echeance.getFullYear(),
    echeance.getMonth(),
    echeance.getDate()
  ).getTime()
  const jourCourant = new Date(
    debutDeJournee.getFullYear(),
    debutDeJournee.getMonth(),
    debutDeJournee.getDate()
  ).getTime()
  return Math.round((jourEcheance - jourCourant) / 86_400_000)
}

/**
 * Le palier applicable à une échéance, ou `null` s'il n'y a rien à envoyer aujourd'hui.
 *
 * Rend `null` aussi pour une échéance DÉPASSÉE : le retard n'est pas un rappel d'échéance, et
 * relancer tous les jours sur une tâche en retard n'a pas été demandé.
 */
export function palierDeRappel(echeance: Date, debutDeJournee: Date): TaskDeadlineKind | null {
  const jours = joursAvant(echeance, debutDeJournee)
  const palier = PALIERS.find((p) => p === jours)
  return palier === undefined ? null : KIND_PAR_PALIER[palier]
}
