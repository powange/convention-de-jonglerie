/**
 * Loaders de traductions pour le lazy loading
 *
 * Ce fichier contient tous les loaders de traductions utilisés par :
 * - Le middleware global de navigation (load-translations.global.ts)
 * - Le composant de sélection de langue (SelectLanguage.vue)
 *
 * Vite nécessite des chemins statiques pour l'analyse des imports.
 */

/**
 * Détermine quelles traductions charger selon le chemin de la route
 */
export function getTranslationsToLoad(path: string): string[] {
  const translationsToLoad: string[] = []

  // Routes statiques
  const routeTranslations: Record<string, string[]> = {
    '/admin': ['admin', 'auth'],
    '/editions': ['edition'],
    '/auth': ['auth'],
    '/login': ['auth'],
    '/register': ['auth'],
    '/profile': ['auth'],
    '/verify-email': ['auth'],
    '/reset-password': ['auth'],
    '/forgot-password': ['auth'],
  }

  // Vérifier les routes statiques
  for (const [route, translations] of Object.entries(routeTranslations)) {
    if (path.startsWith(route)) {
      translationsToLoad.push(...translations)
    }
  }

  // Routes dynamiques avec regex
  const dynamicRoutePatterns: Array<{ pattern: RegExp; translations: string[] }> = [
    {
      pattern: /^\/editions\/\d+\/gestion$/,
      translations: ['gestion', 'workshops'],
    },
    {
      pattern: /^\/editions\/\d+\/gestion\/ticketing/,
      translations: ['ticketing'],
    },
    {
      pattern: /^\/editions\/\d+\/gestion\/meals/,
      translations: ['gestion'],
    },
    {
      pattern: /^\/editions\/\d+\/gestion\/volunteers/,
      translations: ['gestion'],
    },
    {
      pattern: /^\/editions\/\d+\/gestion\/artists/,
      translations: ['artists'],
    },
    {
      pattern: /^\/editions\/\d+\/workshops/,
      translations: ['workshops'],
    },
  ]

  // Vérifier les routes dynamiques
  for (const { pattern, translations } of dynamicRoutePatterns) {
    if (pattern.test(path)) {
      translationsToLoad.push(...translations)
    }
  }

  // Retourner un tableau unique (sans doublons)
  return [...new Set(translationsToLoad)]
}

export const translationLoaders: Record<string, Record<string, () => Promise<any>>> = {
  admin: {
    en: () => import('~~/i18n/locales/en/admin.json'),
    da: () => import('~~/i18n/locales/da/admin.json'),
    de: () => import('~~/i18n/locales/de/admin.json'),
    es: () => import('~~/i18n/locales/es/admin.json'),
    fr: () => import('~~/i18n/locales/fr/admin.json'),
    it: () => import('~~/i18n/locales/it/admin.json'),
    nl: () => import('~~/i18n/locales/nl/admin.json'),
    pl: () => import('~~/i18n/locales/pl/admin.json'),
    pt: () => import('~~/i18n/locales/pt/admin.json'),
    ru: () => import('~~/i18n/locales/ru/admin.json'),
    uk: () => import('~~/i18n/locales/uk/admin.json'),
    cs: () => import('~~/i18n/locales/cs/admin.json'),
    sv: () => import('~~/i18n/locales/sv/admin.json'),
  },
  edition: {
    en: () => import('~~/i18n/locales/en/edition.json'),
    da: () => import('~~/i18n/locales/da/edition.json'),
    de: () => import('~~/i18n/locales/de/edition.json'),
    es: () => import('~~/i18n/locales/es/edition.json'),
    fr: () => import('~~/i18n/locales/fr/edition.json'),
    it: () => import('~~/i18n/locales/it/edition.json'),
    nl: () => import('~~/i18n/locales/nl/edition.json'),
    pl: () => import('~~/i18n/locales/pl/edition.json'),
    pt: () => import('~~/i18n/locales/pt/edition.json'),
    ru: () => import('~~/i18n/locales/ru/edition.json'),
    uk: () => import('~~/i18n/locales/uk/edition.json'),
    cs: () => import('~~/i18n/locales/cs/edition.json'),
    sv: () => import('~~/i18n/locales/sv/edition.json'),
  },
  auth: {
    en: () => import('~~/i18n/locales/en/auth.json'),
    da: () => import('~~/i18n/locales/da/auth.json'),
    de: () => import('~~/i18n/locales/de/auth.json'),
    es: () => import('~~/i18n/locales/es/auth.json'),
    fr: () => import('~~/i18n/locales/fr/auth.json'),
    it: () => import('~~/i18n/locales/it/auth.json'),
    nl: () => import('~~/i18n/locales/nl/auth.json'),
    pl: () => import('~~/i18n/locales/pl/auth.json'),
    pt: () => import('~~/i18n/locales/pt/auth.json'),
    ru: () => import('~~/i18n/locales/ru/auth.json'),
    uk: () => import('~~/i18n/locales/uk/auth.json'),
    cs: () => import('~~/i18n/locales/cs/auth.json'),
    sv: () => import('~~/i18n/locales/sv/auth.json'),
  },
  ticketing: {
    en: () => import('~~/i18n/locales/en/ticketing.json'),
    da: () => import('~~/i18n/locales/da/ticketing.json'),
    de: () => import('~~/i18n/locales/de/ticketing.json'),
    es: () => import('~~/i18n/locales/es/ticketing.json'),
    fr: () => import('~~/i18n/locales/fr/ticketing.json'),
    it: () => import('~~/i18n/locales/it/ticketing.json'),
    nl: () => import('~~/i18n/locales/nl/ticketing.json'),
    pl: () => import('~~/i18n/locales/pl/ticketing.json'),
    pt: () => import('~~/i18n/locales/pt/ticketing.json'),
    ru: () => import('~~/i18n/locales/ru/ticketing.json'),
    uk: () => import('~~/i18n/locales/uk/ticketing.json'),
    cs: () => import('~~/i18n/locales/cs/ticketing.json'),
    sv: () => import('~~/i18n/locales/sv/ticketing.json'),
  },
  workshops: {
    en: () => import('~~/i18n/locales/en/workshops.json'),
    da: () => import('~~/i18n/locales/da/workshops.json'),
    de: () => import('~~/i18n/locales/de/workshops.json'),
    es: () => import('~~/i18n/locales/es/workshops.json'),
    fr: () => import('~~/i18n/locales/fr/workshops.json'),
    it: () => import('~~/i18n/locales/it/workshops.json'),
    nl: () => import('~~/i18n/locales/nl/workshops.json'),
    pl: () => import('~~/i18n/locales/pl/workshops.json'),
    pt: () => import('~~/i18n/locales/pt/workshops.json'),
    ru: () => import('~~/i18n/locales/ru/workshops.json'),
    uk: () => import('~~/i18n/locales/uk/workshops.json'),
    cs: () => import('~~/i18n/locales/cs/workshops.json'),
    sv: () => import('~~/i18n/locales/sv/workshops.json'),
  },
  artists: {
    en: () => import('~~/i18n/locales/en/artists.json'),
    da: () => import('~~/i18n/locales/da/artists.json'),
    de: () => import('~~/i18n/locales/de/artists.json'),
    es: () => import('~~/i18n/locales/es/artists.json'),
    fr: () => import('~~/i18n/locales/fr/artists.json'),
    it: () => import('~~/i18n/locales/it/artists.json'),
    nl: () => import('~~/i18n/locales/nl/artists.json'),
    pl: () => import('~~/i18n/locales/pl/artists.json'),
    pt: () => import('~~/i18n/locales/pt/artists.json'),
    ru: () => import('~~/i18n/locales/ru/artists.json'),
    uk: () => import('~~/i18n/locales/uk/artists.json'),
    cs: () => import('~~/i18n/locales/cs/artists.json'),
    sv: () => import('~~/i18n/locales/sv/artists.json'),
  },
  gestion: {
    en: () => import('~~/i18n/locales/en/gestion.json'),
    da: () => import('~~/i18n/locales/da/gestion.json'),
    de: () => import('~~/i18n/locales/de/gestion.json'),
    es: () => import('~~/i18n/locales/es/gestion.json'),
    fr: () => import('~~/i18n/locales/fr/gestion.json'),
    it: () => import('~~/i18n/locales/it/gestion.json'),
    nl: () => import('~~/i18n/locales/nl/gestion.json'),
    pl: () => import('~~/i18n/locales/pl/gestion.json'),
    pt: () => import('~~/i18n/locales/pt/gestion.json'),
    ru: () => import('~~/i18n/locales/ru/gestion.json'),
    uk: () => import('~~/i18n/locales/uk/gestion.json'),
    cs: () => import('~~/i18n/locales/cs/gestion.json'),
    sv: () => import('~~/i18n/locales/sv/gestion.json'),
  },
}
