/**
 * Patterns d'extraction d'heures depuis du contenu textuel
 *
 * Ces patterns sont utilisés pour extraire automatiquement les heures
 * de début et de fin d'un événement depuis sa description.
 */

import { loggers } from './logger'

const log = loggers.agent

/**
 * Pattern avec son label pour le debugging
 */
export interface TimePattern {
  pattern: RegExp
  label: string
}

/**
 * Patterns spécifiques pour les heures de début de convention
 */
export const START_TIME_PATTERNS: TimePattern[] = [
  {
    // "ouverture vendredi à 18h" / "ouverture le vendredi à 18h"
    pattern:
      /ouverture\s+(?:le\s+)?(?:vendredi|samedi|dimanche|jeudi)?\s*(?:à|a|:)?\s*(\d{1,2})[h:](\d{2})?/gi,
    label: 'ouverture',
  },
  {
    // "début vendredi 18h" / "début à 14h"
    pattern:
      /d[eé]but\s+(?:le\s+)?(?:vendredi|samedi|dimanche|jeudi)?\s*(?:à|a|:)?\s*(\d{1,2})[h:](\d{2})?/gi,
    label: 'début',
  },
  {
    // "à partir de 10h"
    pattern: /[àa]\s*partir\s+de\s+(\d{1,2})[h:](\d{2})?/gi,
    label: 'à partir de',
  },
  {
    // "dès 10h" / "dès 10:00"
    pattern: /d[eè]s\s+(\d{1,2})[h:](\d{2})?/gi,
    label: 'dès',
  },
  {
    // "from 10am" / "from 2pm"
    pattern: /from\s+(\d{1,2})\s*(?:am|pm|h)/gi,
    label: 'from',
  },
  {
    // "accueil à partir de 14h"
    pattern: /accueil\s+(?:à\s+partir\s+de\s+)?(\d{1,2})[h:](\d{2})?/gi,
    label: 'accueil',
  },
]

/**
 * Patterns spécifiques pour les heures de fin de convention
 */
export const END_TIME_PATTERNS: TimePattern[] = [
  {
    // "fermeture dimanche à 18h"
    pattern:
      /fermeture\s+(?:le\s+)?(?:dimanche|samedi|lundi)?\s*(?:à|a|:)?\s*(\d{1,2})[h:](\d{2})?/gi,
    label: 'fermeture',
  },
  {
    // "fin dimanche 18h" / "fin à 18h"
    pattern: /fin\s+(?:le\s+)?(?:dimanche|samedi|lundi)?\s*(?:à|a|:)?\s*(\d{1,2})[h:](\d{2})?/gi,
    label: 'fin',
  },
  {
    // "jusqu'à 18h"
    pattern: /jusqu['']?\s*[àa]\s*(\d{1,2})[h:](\d{2})?/gi,
    label: "jusqu'à",
  },
  {
    // "clôture à 17h"
    pattern: /cl[oô]ture\s+(?:à|a)?\s*(\d{1,2})[h:](\d{2})?/gi,
    label: 'clôture',
  },
]

/**
 * Patterns génériques pour les heures (fallback)
 */
export const GENERIC_TIME_PATTERNS: TimePattern[] = [
  {
    // "10h30", "10:30"
    pattern: /(\d{1,2})[h:](\d{2})/g,
    label: 'heure complète',
  },
  {
    // "10h" seul
    pattern: /(\d{1,2})h(?!\d)/g,
    label: 'heure simple',
  },
]

/**
 * Extrait une heure depuis un match regex
 * Valide que l'heure est entre 6h et 23h (heures raisonnables pour une convention)
 */
export function extractTimeFromMatch(match: RegExpExecArray): string | null {
  const hours = parseInt(match[1], 10)
  const minutes = match[2] ? parseInt(match[2], 10) : 0

  // Valider l'heure (entre 6h et 23h pour une convention)
  if (hours >= 6 && hours <= 23 && minutes >= 0 && minutes < 60) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`
  }
  return null
}

/**
 * Recherche une heure avec les patterns spécifiés
 */
function findTimeWithPatterns(
  content: string,
  patterns: TimePattern[],
  logPrefix: string
): string | null {
  for (const { pattern, label } of patterns) {
    pattern.lastIndex = 0 // Reset le pattern
    const match = pattern.exec(content)
    if (match) {
      const time = extractTimeFromMatch(match)
      if (time) {
        log.debug(`Heure ${logPrefix} trouvée avec pattern "${label}": ${time}`)
        return time
      }
    }
  }
  return null
}

/**
 * Extrait toutes les heures génériques du contenu
 */
function extractAllGenericTimes(content: string): string[] {
  const allTimes: string[] = []

  for (const { pattern } of GENERIC_TIME_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(content)) !== null) {
      const time = extractTimeFromMatch(match)
      if (time && !allTimes.includes(time)) {
        allTimes.push(time)
      }
    }
  }

  return allTimes.sort()
}

/**
 * Extrait l'heure de début depuis le contenu
 */
export function extractStartTime(content: string): string | null {
  const lowerContent = content.toLowerCase()

  // Essayer d'abord avec les patterns spécifiques
  const specificTime = findTimeWithPatterns(lowerContent, START_TIME_PATTERNS, 'de début')
  if (specificTime) return specificTime

  // Fallback: chercher toutes les heures génériques et prendre une heure de matin/début d'après-midi
  const allTimes = extractAllGenericTimes(lowerContent)
  if (allTimes.length > 0) {
    // Prendre une heure raisonnable pour un début (entre 8h et 14h de préférence)
    const earlyTimes = allTimes.filter((t) => {
      const h = parseInt(t.split(':')[0], 10)
      return h >= 8 && h <= 14
    })
    const fallbackTime = earlyTimes[0] || allTimes[0]
    log.debug(`Heure de début (fallback): ${fallbackTime}`)
    return fallbackTime
  }

  return null
}

/**
 * Extrait l'heure de fin depuis le contenu
 */
export function extractEndTime(content: string): string | null {
  const lowerContent = content.toLowerCase()

  // Essayer d'abord avec les patterns spécifiques
  const specificTime = findTimeWithPatterns(lowerContent, END_TIME_PATTERNS, 'de fin')
  if (specificTime) return specificTime

  // Fallback: chercher toutes les heures génériques et prendre une heure tardive
  const allTimes = extractAllGenericTimes(lowerContent)
  if (allTimes.length > 0) {
    // Prendre une heure raisonnable pour une fin (entre 16h et 22h de préférence)
    const lateTimes = allTimes.filter((t) => {
      const h = parseInt(t.split(':')[0], 10)
      return h >= 16 && h <= 22
    })
    const fallbackTime = lateTimes[lateTimes.length - 1] || allTimes[allTimes.length - 1]
    log.debug(`Heure de fin (fallback): ${fallbackTime}`)
    return fallbackTime
  }

  return null
}

/**
 * Extrait les heures du contenu texte et les applique aux dates si absentes
 *
 * @param parsedJson - Le JSON parsé contenant les dates de l'édition
 * @param collectedContent - Le contenu textuel collecté
 */
export function extractAndApplyTimeFromContent(
  parsedJson: { edition?: { startDate?: string; endDate?: string } },
  collectedContent: string[]
): void {
  // Si les dates contiennent déjà des heures (format avec T), ne rien faire
  const startDate = parsedJson.edition?.startDate || ''
  const endDate = parsedJson.edition?.endDate || ''

  const startHasTime = startDate.includes('T')
  const endHasTime = endDate.includes('T')

  if (startHasTime && endHasTime) {
    log.debug('Dates contiennent déjà des heures, pas de modification')
    return
  }

  // Chercher les heures dans le contenu
  const fullContent = collectedContent.join(' ')
  log.debug(`Recherche d'heures dans ${fullContent.length} caractères de contenu`)

  // Chercher l'heure de début
  if (!startHasTime && startDate) {
    const foundStartTime = extractStartTime(fullContent)
    if (foundStartTime) {
      parsedJson.edition!.startDate = `${startDate}T${foundStartTime}`
      log.info(`startDate enrichie: ${parsedJson.edition!.startDate}`)
    } else {
      log.debug("Pas d'heure de début trouvée, date non modifiée")
    }
  }

  // Chercher l'heure de fin
  if (!endHasTime && endDate) {
    const foundEndTime = extractEndTime(fullContent)
    if (foundEndTime) {
      parsedJson.edition!.endDate = `${endDate}T${foundEndTime}`
      log.info(`endDate enrichie: ${parsedJson.edition!.endDate}`)
    } else {
      log.debug("Pas d'heure de fin trouvée, date non modifiée")
    }
  }
}
