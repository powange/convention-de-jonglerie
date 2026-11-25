/**
 * Configuration centralisée des locales supportées par app2.
 * Utilisable côté client ET serveur.
 *
 * app2 est en français uniquement. Le layer d'auth partagé importe
 * `SUPPORTED_LOCALE_CODES` (via `@@/app/utils/locales`) pour valider la langue
 * préférée déduite de l'en-tête `Accept-Language` lors de l'inscription.
 */
export const SUPPORTED_LOCALE_CODES = ['fr'] as const

/**
 * Type pour les codes de langues supportées
 */
export type SupportedLocaleCode = (typeof SUPPORTED_LOCALE_CODES)[number]

/**
 * Locale par défaut de l'application
 */
export const DEFAULT_LOCALE: SupportedLocaleCode = 'fr'

/**
 * Retourne la liste des codes de langues supportées
 */
export function getSupportedLocalesCodes(): readonly SupportedLocaleCode[] {
  return SUPPORTED_LOCALE_CODES
}

/**
 * Vérifie si un code de langue est supporté
 */
export function isSupportedLocale(locale: string): locale is SupportedLocaleCode {
  return SUPPORTED_LOCALE_CODES.includes(locale as SupportedLocaleCode)
}

/**
 * Code de langue de l'application → étiquette BCP 47 pour `Intl` (dates, nombres).
 *
 * Contrat d'hôte : `layers/core/app/composables/useDateFormat.ts` l'importe depuis
 * `~/utils/locales`, que chaque app fournit. Flowvent étant en français seul, la table se réduit
 * à une entrée ; un code inconnu est rendu tel quel, comme dans app1.
 */
const INTL_LOCALE_MAP: Record<string, string> = { fr: 'fr-FR' }

export function toIntlLocale(code: string): string {
  return INTL_LOCALE_MAP[code] ?? code
}
