/**
 * Configuration centralisée des locales/langues supportées par l'application.
 * Ce fichier peut être utilisé côté client ET serveur.
 */

export interface LocaleConfig {
  code: string
  language?: string
  name: string
  files?: string[]
}

/**
 * Liste des codes de langues supportées (ordre alphabétique pour cohérence)
 */
export const SUPPORTED_LOCALE_CODES = [
  'cs',
  'da',
  'de',
  'en',
  'es',
  'fr',
  'it',
  'nl',
  'pl',
  'pt',
  'ru',
  'sv',
  'uk',
] as const

/**
 * Type pour les codes de langues supportées
 */
export type SupportedLocaleCode = (typeof SUPPORTED_LOCALE_CODES)[number]

/**
 * Configuration complète des locales avec noms et fichiers de traduction
 */
export const LOCALES_CONFIG: LocaleConfig[] = [
  {
    code: 'cs',
    language: 'cs',
    name: 'Čeština',
    files: [
      'cs/common.json',
      'cs/notifications.json',
      'cs/components.json',
      'cs/app.json',
      'cs/public.json',
    ],
  },
  {
    code: 'da',
    language: 'da',
    name: 'Dansk',
    files: [
      'da/common.json',
      'da/notifications.json',
      'da/components.json',
      'da/app.json',
      'da/public.json',
    ],
  },
  {
    code: 'de',
    language: 'de',
    name: 'Deutsch',
    files: [
      'de/common.json',
      'de/notifications.json',
      'de/components.json',
      'de/app.json',
      'de/public.json',
    ],
  },
  {
    code: 'en',
    language: 'en',
    name: 'English',
    files: [
      'en/common.json',
      'en/notifications.json',
      'en/components.json',
      'en/app.json',
      'en/public.json',
    ],
  },
  {
    code: 'es',
    language: 'es',
    name: 'Español',
    files: [
      'es/common.json',
      'es/notifications.json',
      'es/components.json',
      'es/app.json',
      'es/public.json',
    ],
  },
  {
    code: 'fr',
    language: 'fr',
    name: 'Français',
    files: [
      'fr/common.json',
      'fr/notifications.json',
      'fr/components.json',
      'fr/app.json',
      'fr/public.json',
    ],
  },
  {
    code: 'it',
    language: 'it',
    name: 'Italiano',
    files: [
      'it/common.json',
      'it/notifications.json',
      'it/components.json',
      'it/app.json',
      'it/public.json',
    ],
  },
  {
    code: 'nl',
    language: 'nl',
    name: 'Nederlands',
    files: [
      'nl/common.json',
      'nl/notifications.json',
      'nl/components.json',
      'nl/app.json',
      'nl/public.json',
    ],
  },
  {
    code: 'pl',
    language: 'pl',
    name: 'Polski',
    files: [
      'pl/common.json',
      'pl/notifications.json',
      'pl/components.json',
      'pl/app.json',
      'pl/public.json',
    ],
  },
  {
    code: 'pt',
    language: 'pt',
    name: 'Português',
    files: [
      'pt/common.json',
      'pt/notifications.json',
      'pt/components.json',
      'pt/app.json',
      'pt/public.json',
    ],
  },
  {
    code: 'ru',
    language: 'ru',
    name: 'Русский',
    files: [
      'ru/common.json',
      'ru/notifications.json',
      'ru/components.json',
      'ru/app.json',
      'ru/public.json',
    ],
  },
  {
    code: 'sv',
    language: 'sv',
    name: 'Svenska',
    files: [
      'sv/common.json',
      'sv/notifications.json',
      'sv/components.json',
      'sv/app.json',
      'sv/public.json',
    ],
  },
  {
    code: 'uk',
    language: 'uk',
    name: 'Українська',
    files: [
      'uk/common.json',
      'uk/notifications.json',
      'uk/components.json',
      'uk/app.json',
      'uk/public.json',
    ],
  },
]

/**
 * Locale par défaut de l'application
 */
export const DEFAULT_LOCALE: SupportedLocaleCode = 'en'

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
 * Retourne le nom d'une locale à partir de son code
 */
export function getLocaleName(code: string): string | undefined {
  return LOCALES_CONFIG.find((l) => l.code === code)?.name
}

/**
 * Mapping des codes de langues vers le drapeau correspondant, au format Iconify.
 *
 * Le code du pays diffère parfois de celui de la langue : l'anglais prend le drapeau
 * britannique, le danois le danois, l'ukrainien celui de l'Ukraine, etc.
 */
const FLAG_MAP: Record<string, string> = {
  en: 'i-flag:gb-4x3',
  da: 'i-flag:dk-4x3',
  de: 'i-flag:de-4x3',
  es: 'i-flag:es-4x3',
  fr: 'i-flag:fr-4x3',
  it: 'i-flag:it-4x3',
  nl: 'i-flag:nl-4x3',
  pl: 'i-flag:pl-4x3',
  pt: 'i-flag:pt-4x3',
  ru: 'i-flag:ru-4x3',
  uk: 'i-flag:ua-4x3',
  cs: 'i-flag:cz-4x3',
  sv: 'i-flag:se-4x3',
} as const

/**
 * Retourne le flag d'une locale à partir de son code
 */
export function languageCodeToFlag(code: string): string | undefined {
  return FLAG_MAP[code]
}
