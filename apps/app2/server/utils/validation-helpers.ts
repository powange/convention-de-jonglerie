/**
 * Helpers de validation/sanitisation (version minimale app2).
 * Seules les deux fonctions consommées par `layers/auth/` sont exposées.
 */

/**
 * Sanitise une chaîne de caractères (trim + normalisation).
 * Retourne `null` pour une valeur vide/absente.
 */
export function sanitizeString(value: string | null | undefined): string | null {
  if (!value || typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Sanitise un email (lowercase + trim).
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim()
}
