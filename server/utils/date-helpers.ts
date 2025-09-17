/**
 * Utilitaires pour la gestion des dates côté serveur
 */

/**
 * Normalise une date vers le format ISO UTC
 * Accepte les dates en format datetime-local ou ISO
 * @param dateString - String de date à normaliser
 * @returns String ISO UTC ou null si invalide
 */
export const normalizeDateToISO = (dateString: string | null | undefined): string | null => {
  if (!dateString?.trim()) return null

  try {
    const date = new Date(dateString)

    // Vérifier que la date est valide
    if (isNaN(date.getTime())) return null

    return date.toISOString()
  } catch {
    return null
  }
}

/**
 * Valide qu'une string de date est parsable
 * @param dateString - String à valider
 * @returns true si la date est valide
 */
export const isValidDateString = (dateString: string): boolean => {
  if (!dateString?.trim()) return false

  try {
    const date = new Date(dateString)
    return !isNaN(date.getTime())
  } catch {
    return false
  }
}

/**
 * Valide qu'une date de fin est postérieure à une date de début
 * @param startDate - Date de début (string)
 * @param endDate - Date de fin (string)
 * @returns true si la plage est valide
 */
export const validateDateRange = (startDate: string, endDate: string): boolean => {
  if (!startDate || !endDate) return true // Laisser la validation Zod gérer les champs requis

  try {
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return false

    return end > start
  } catch {
    return false
  }
}

/**
 * Formate une date pour l'affichage (côté serveur, pour les logs par exemple)
 * @param date - Date à formater
 * @param locale - Locale (défaut: 'fr-FR')
 * @returns String formatée
 */
export const formatDateForDisplay = (date: Date | string, locale: string = 'fr-FR'): string => {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date

    if (isNaN(dateObj.getTime())) return 'Date invalide'

    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris', // Fuseau horaire français pour les logs
    }).format(dateObj)
  } catch {
    return 'Date invalide'
  }
}
