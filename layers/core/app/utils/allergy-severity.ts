export type AllergySeverityLevel = 'LIGHT' | 'MODERATE' | 'SEVERE' | 'CRITICAL'

export interface AllergySeverityOption {
  value: AllergySeverityLevel
  label: string
  description: string
  color: string
  icon: string
  priority: number
}

/**
 * Définit les niveaux de sévérité des allergies avec leurs métadonnées
 */
export const ALLERGY_SEVERITY_LEVELS: Record<AllergySeverityLevel, AllergySeverityOption> = {
  LIGHT: {
    value: 'LIGHT',
    label: 'edition.volunteers.allergy_severity_light_short',
    description: 'edition.volunteers.allergy_severity_light_description',
    color: 'neutral',
    icon: 'i-heroicons-exclamation-triangle',
    priority: 1,
  },
  MODERATE: {
    value: 'MODERATE',
    label: 'edition.volunteers.allergy_severity_moderate_short',
    description: 'edition.volunteers.allergy_severity_moderate_description',
    color: 'info',
    icon: 'i-heroicons-exclamation-triangle',
    priority: 2,
  },
  SEVERE: {
    value: 'SEVERE',
    label: 'edition.volunteers.allergy_severity_severe_short',
    description: 'edition.volunteers.allergy_severity_severe_description',
    color: 'warning',
    icon: 'i-heroicons-exclamation-circle',
    priority: 3,
  },
  CRITICAL: {
    value: 'CRITICAL',
    label: 'edition.volunteers.allergy_severity_critical_short',
    description: 'edition.volunteers.allergy_severity_critical_description',
    color: 'error',
    icon: 'i-heroicons-shield-exclamation',
    priority: 4,
  },
}

/**
 * Retourne toutes les options de sévérité d'allergie triées par priorité
 */
export function getAllergySeverityOptions(): AllergySeverityOption[] {
  return Object.values(ALLERGY_SEVERITY_LEVELS).sort((a, b) => a.priority - b.priority)
}

/**
 * Retourne les métadonnées d'un niveau de sévérité spécifique
 */
export function getAllergySeverityInfo(level: AllergySeverityLevel): AllergySeverityOption {
  return ALLERGY_SEVERITY_LEVELS[level]
}

/**
 * Retourne les options formatées pour les composants de sélection (USelect, etc.)
 */
export function getAllergySeveritySelectOptions(): Array<{
  value: AllergySeverityLevel
  label: string
}> {
  return getAllergySeverityOptions().map((option) => ({
    value: option.value,
    label: option.label,
  }))
}

/**
 * Détermine si un niveau de sévérité nécessite un contact d'urgence obligatoire
 */
export function requiresEmergencyContact(level: AllergySeverityLevel): boolean {
  return level === 'SEVERE' || level === 'CRITICAL'
}

/**
 * Retourne la classe CSS pour la couleur d'un badge selon le niveau
 */
export function getAllergySeverityBadgeColor(level: AllergySeverityLevel): string {
  const info = getAllergySeverityInfo(level)
  return info.color
}

/**
 * Retourne l'icône appropriée pour un niveau de sévérité
 */
export function getAllergySeverityIcon(level: AllergySeverityLevel): string {
  const info = getAllergySeverityInfo(level)
  return info.icon
}

/**
 * Retourne la clé i18n pour la description d'un niveau de sévérité
 */
export function getAllergySeverityDescriptionKey(level: AllergySeverityLevel): string {
  const info = getAllergySeverityInfo(level)
  return info.description
}

/**
 * Vérifie si un niveau de sévérité est valide
 */
export function isValidAllergySeverityLevel(level: string): level is AllergySeverityLevel {
  return Object.keys(ALLERGY_SEVERITY_LEVELS).includes(level as AllergySeverityLevel)
}

/**
 * Retourne les classes CSS complètes pour un badge de sévérité d'allergie
 * Mappe les couleurs de l'utilitaire vers les classes Tailwind spécifiques
 */
export function getAllergySeverityBadgeClasses(level: AllergySeverityLevel): string {
  const colorMap: Record<string, string> = {
    neutral: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
    info: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    warning: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  }

  const uiColor = getAllergySeverityBadgeColor(level)
  return (colorMap[uiColor] ?? colorMap.neutral) as string
}
