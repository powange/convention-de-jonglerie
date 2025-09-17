/**
 * Composable pour la gestion cohérente des dates entre frontend et backend
 *
 * Principe :
 * - Frontend : Objets Date natifs pour la logique métier
 * - Inputs datetime-local : Conversion locale pour l'affichage
 * - API : Échange en ISO strings UTC uniquement
 * - BDD : DateTime UTC (automatique avec Prisma)
 */

export const useDatetime = () => {
  /**
   * Convertit un objet Date vers le format datetime-local pour les inputs HTML
   * @param date - Date à convertir
   * @returns String au format YYYY-MM-DDTHH:MM pour l'input datetime-local
   */
  const toDatetimeLocal = (date: Date | string | null): string => {
    if (!date) return ''

    const dateObj = typeof date === 'string' ? new Date(date) : date

    // Vérifier que la date est valide
    if (isNaN(dateObj.getTime())) return ''

    // Convertir en heure locale pour l'affichage dans l'input
    const offset = dateObj.getTimezoneOffset() * 60000
    const localDate = new Date(dateObj.getTime() - offset)

    return localDate.toISOString().slice(0, 16)
  }

  /**
   * Convertit une valeur d'input datetime-local vers un objet Date UTC
   * @param value - Valeur de l'input datetime-local (YYYY-MM-DDTHH:MM)
   * @returns Date qui représente la même heure mais interprétée comme locale
   */
  const fromDatetimeLocal = (value: string): Date | null => {
    if (!value || !value.trim()) return null

    // L'input datetime-local donne une chaîne sans timezone
    // On la traite comme une heure locale et on crée directement une Date
    const localDate = new Date(value)

    // Vérifier que la date est valide
    if (isNaN(localDate.getTime())) return null

    // La Date JavaScript stocke en UTC mais l'interprète selon le fuseau local
    // Pas besoin d'ajustement car new Date(value) fait déjà le travail
    return localDate
  }

  /**
   * Convertit une date vers une string ISO UTC pour l'API
   * @param date - Date à convertir
   * @returns String ISO UTC ou null
   */
  const toApiFormat = (date: Date | null): string | null => {
    if (!date || isNaN(date.getTime())) return null
    return date.toISOString()
  }

  /**
   * Parse une date venant de l'API (ISO string) vers un objet Date
   * @param isoString - String ISO de l'API
   * @returns Date ou null si invalide
   */
  const fromApiFormat = (isoString: string | null): Date | null => {
    if (!isoString) return null
    const date = new Date(isoString)
    return isNaN(date.getTime()) ? null : date
  }

  /**
   * Formate une date pour l'affichage utilisateur
   * @param date - Date à formater
   * @param locale - Locale pour le formatage (défaut: 'fr-FR')
   * @param options - Options de formatage
   * @returns String formatée
   */
  const formatForDisplay = (
    date: Date | string | null,
    locale: string = 'fr-FR',
    options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }
  ): string => {
    if (!date) return ''

    const dateObj = typeof date === 'string' ? new Date(date) : date

    if (isNaN(dateObj.getTime())) return ''

    return new Intl.DateTimeFormat(locale, options).format(dateObj)
  }

  /**
   * Valide qu'une date de fin est postérieure à une date de début
   * @param startDate - Date de début
   * @param endDate - Date de fin
   * @returns true si valide, false sinon
   */
  const validateDateRange = (startDate: Date | null, endDate: Date | null): boolean => {
    if (!startDate || !endDate) return true // Si l'une des dates manque, on laisse la validation Zod gérer
    return endDate > startDate
  }

  /**
   * Crée un objet Date en local (sans conversion UTC)
   * Utile pour les événements locaux où le fuseau horaire est fixe
   * @param year - Année
   * @param month - Mois (1-12)
   * @param day - Jour
   * @param hour - Heure (défaut: 0)
   * @param minute - Minute (défaut: 0)
   * @returns Date locale
   */
  const createLocalDate = (
    year: number,
    month: number,
    day: number,
    hour: number = 0,
    minute: number = 0
  ): Date => {
    return new Date(year, month - 1, day, hour, minute)
  }

  return {
    toDatetimeLocal,
    fromDatetimeLocal,
    toApiFormat,
    fromApiFormat,
    formatForDisplay,
    validateDateRange,
    createLocalDate,
  }
}
