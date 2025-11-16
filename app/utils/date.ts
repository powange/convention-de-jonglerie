export interface DateFormatOptions {
  locale?: string
  includeTime?: boolean
  format?: 'short' | 'medium' | 'long'
}

/**
 * Formate une date selon les options spécifiées
 * @param date - La date à formater (string ou Date)
 * @param options - Options de formatage
 * @returns La date formatée en string
 */
export const formatDate = (date: string | Date, options: DateFormatOptions = {}): string => {
  const { locale = 'fr-FR', includeTime = false, format = 'medium' } = options

  const dateObj = typeof date === 'string' ? new Date(date) : date

  // Vérifier si la date est valide
  if (isNaN(dateObj.getTime())) {
    return ''
  }

  const formatOptions: Intl.DateTimeFormatOptions = {}

  // Configuration selon le format
  switch (format) {
    case 'short':
      formatOptions.day = '2-digit'
      formatOptions.month = '2-digit'
      formatOptions.year = 'numeric'
      break
    case 'long':
      formatOptions.weekday = 'long'
      formatOptions.day = 'numeric'
      formatOptions.month = 'long'
      formatOptions.year = 'numeric'
      break
    case 'medium':
    default:
      formatOptions.day = 'numeric'
      formatOptions.month = 'long'
      formatOptions.year = 'numeric'
      break
  }

  // Ajouter l'heure si demandé
  if (includeTime) {
    formatOptions.hour = '2-digit'
    formatOptions.minute = '2-digit'
  }

  return dateObj.toLocaleDateString(locale, formatOptions)
}

/**
 * Formate une date relative (il y a X jours, dans X heures, etc.)
 * @param date - La date à formater
 * @param locale - La locale à utiliser
 * @returns La date formatée en string relatif
 */
export const formatRelativeDate = (date: string | Date, locale: string = 'fr'): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffInMs = dateObj.getTime() - now.getTime()
  const diffInSeconds = Math.floor(diffInMs / 1000)
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  const diffInHours = Math.floor(diffInMinutes / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (Math.abs(diffInDays) >= 30) {
    const diffInMonths = Math.floor(diffInDays / 30)
    return rtf.format(diffInMonths, 'month')
  }
  if (Math.abs(diffInDays) >= 1) {
    return rtf.format(diffInDays, 'day')
  }
  if (Math.abs(diffInHours) >= 1) {
    return rtf.format(diffInHours, 'hour')
  }
  if (Math.abs(diffInMinutes) >= 1) {
    return rtf.format(diffInMinutes, 'minute')
  }
  return rtf.format(diffInSeconds, 'second')
}

/**
 * Formate une plage de dates
 * @param startDate - Date de début
 * @param endDate - Date de fin
 * @param options - Options de formatage
 * @returns La plage de dates formatée
 */
export const formatDateRange = (
  startDate: string | Date,
  endDate: string | Date,
  options: DateFormatOptions = {}
): string => {
  const start = formatDate(startDate, options)
  const end = formatDate(endDate, options)

  const startObj = typeof startDate === 'string' ? new Date(startDate) : startDate
  const endObj = typeof endDate === 'string' ? new Date(endDate) : endDate

  // Si même jour, afficher une seule date
  if (
    startObj.getDate() === endObj.getDate() &&
    startObj.getMonth() === endObj.getMonth() &&
    startObj.getFullYear() === endObj.getFullYear()
  ) {
    return start
  }

  // Si même mois et année
  if (
    startObj.getMonth() === endObj.getMonth() &&
    startObj.getFullYear() === endObj.getFullYear()
  ) {
    const dayStart = startObj.getDate()
    const dayEnd = endObj.getDate()
    const month = startObj.toLocaleDateString(options.locale || 'fr-FR', { month: 'long' })
    const year = startObj.getFullYear()
    return `${dayStart} - ${dayEnd} ${month} ${year}`
  }

  return `${start} - ${end}`
}

/**
 * Convertit une string datetime-local en objet Date (temps local)
 * @param datetimeLocal - String au format "YYYY-MM-DDTHH:MM"
 * @returns Objet Date en temps local
 */
export const parseDateTimeLocal = (datetimeLocal: string): Date => {
  const [datePart, timePart] = datetimeLocal.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  return new Date(year, month - 1, day, hour, minute)
}

/**
 * Convertit un objet Date en string datetime-local
 * @param date - Objet Date
 * @returns String au format "YYYY-MM-DDTHH:MM"
 */
export const formatDateTimeLocal = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hour}:${minute}`
}

/**
 * Ajoute des heures à une date datetime-local
 * @param datetimeLocal - String au format "YYYY-MM-DDTHH:MM"
 * @param hours - Nombre d'heures à ajouter (peut être décimal)
 * @returns String datetime-local avec les heures ajoutées
 */
export const addHoursToDateTimeLocal = (datetimeLocal: string, hours: number): string => {
  const date = parseDateTimeLocal(datetimeLocal)
  const newDate = new Date(date.getTime() + hours * 60 * 60 * 1000)
  return formatDateTimeLocal(newDate)
}

/**
 * Formate une durée en format compact lisible
 * @param ms - Durée en millisecondes
 * @returns Texte formaté de manière compacte (ex: "2h30", "45min", "3h")
 */
export const formatDurationCompact = (ms: number): string => {
  const totalMinutes = Math.floor(ms / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  // Si moins d'une heure, afficher en minutes
  if (hours === 0) {
    return `${minutes}min`
  }

  // Si pas de minutes, afficher seulement les heures
  if (minutes === 0) {
    return `${hours}h`
  }

  // Afficher heures et minutes
  return `${hours}h${minutes.toString().padStart(2, '0')}`
}
