/**
 * Conversion des dates entre le formulaire et l'API. Rien de plus.
 *
 * ⚠️ Ce composable ne sait PAS ce qu'est un fuseau, et c'est volontaire. Il en a longtemps porté
 * l'apparence — `formatInTimezone`, `formatDateInTimezone`, `formatTimeInTimezone`,
 * `getTimezoneAbbreviation`, `formatWithTimezone` —, six fonctions qu'AUCUN appelant n'utilisait.
 * Elles ne concurrençaient donc rien : elles attendaient simplement d'être trouvées, et de faire
 * écrire un écran de plus contre le fuseau de la machine.
 *
 * Pour tout ce qui touche au fuseau — afficher, saisir, découper les journées —, c'est
 * `~~/shared/utils/fuseau-edition` qui fait foi : il est testé, documenté, et dit POURQUOI le
 * fuseau de la machine ne convient jamais.
 *
 * `toDatetimeLocal` / `fromDatetimeLocal` sont partis avec elles, et pour une raison plus
 * forte : ils ancraient un champ `datetime-local` au fuseau du NAVIGATEUR. C'est exactement le
 * défaut qui faisait enregistrer une heure fausse à qui saisissait un créneau depuis ailleurs.
 * `versInstant` et `versChampLocal` les remplacent.
 *
 * Ce qui reste : l'aller-retour avec l'API, en ISO UTC, et un affichage sans fuseau pour les
 * dates qui n'en demandent pas.
 */

export const useDatetime = () => {
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

  return {
    toApiFormat,
    fromApiFormat,
    formatForDisplay,
  }
}
