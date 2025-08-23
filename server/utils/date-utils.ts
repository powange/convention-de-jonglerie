/**
 * Utilitaires pour gérer les dates
 */

/**
 * Crée une date future à partir d'un offset en millisecondes
 * @param offsetMs - Offset en millisecondes à ajouter à maintenant
 * @returns Date future en heure locale
 */
export function createFutureDate(offsetMs: number = 0): Date {
  return new Date(Date.now() + offsetMs)
}

/**
 * Formate une durée en texte lisible
 * @param ms - Durée en millisecondes
 * @returns Texte formaté (ex: "1 heure", "15 minutes")
 */
export function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / (1000 * 60))
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} jour${days > 1 ? 's' : ''}`
  if (hours > 0) return `${hours} heure${hours > 1 ? 's' : ''}`
  return `${minutes} minute${minutes > 1 ? 's' : ''}`
}

/**
 * Durées standards pour les tokens
 */
export const TOKEN_DURATIONS = {
  EMAIL_VERIFICATION: 15 * 60 * 1000, // 15 minutes
  PASSWORD_RESET: 60 * 60 * 1000, // 1 heure
  REMEMBER_ME: 30 * 24 * 60 * 60 * 1000, // 30 jours
  SESSION: 60 * 60 * 1000, // 1 heure
} as const
