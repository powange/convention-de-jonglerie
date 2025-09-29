export type AllergySeverityLevel = 'LIGHT' | 'MODERATE' | 'SEVERE' | 'CRITICAL'

/**
 * Détermine si un niveau de sévérité nécessite un contact d'urgence obligatoire
 */
export function requiresEmergencyContact(level: AllergySeverityLevel): boolean {
  return level === 'SEVERE' || level === 'CRITICAL'
}

/**
 * Vérifie si un niveau de sévérité est valide
 */
export function isValidAllergySeverityLevel(level: string): level is AllergySeverityLevel {
  return ['LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL'].includes(level as AllergySeverityLevel)
}
