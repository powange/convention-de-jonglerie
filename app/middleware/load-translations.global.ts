/**
 * Middleware global pour charger les traductions à la demande selon la route
 *
 * Ce middleware charge automatiquement les fichiers de traduction nécessaires
 * en fonction de la route visitée, permettant de réduire la taille du bundle initial.
 */

// Map statique des imports pour chaque fichier et locale
// Vite nécessite des chemins statiques pour l'analyse des imports
const translationLoaders: Record<string, Record<string, () => Promise<any>>> = {
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
}

export default defineNuxtRouteMiddleware(async (to) => {
  // Accéder à i18n via nuxtApp dans le contexte du middleware
  const nuxtApp = useNuxtApp()
  const i18n = nuxtApp.$i18n

  if (!i18n) {
    return
  }

  const locale = i18n.locale.value

  // Map des routes vers les fichiers de traduction à charger
  const routeTranslations: Record<string, string[]> = {
    '/admin': ['admin', 'auth'], // admin utilise aussi des clés profile.* depuis auth.json
    '/editions': ['edition'],
    '/auth': ['auth'],
    '/login': ['auth'],
    '/register': ['auth'],
    '/profile': ['auth'],
    '/verify-email': ['auth'],
    '/reset-password': ['auth'],
    '/forgot-password': ['auth'],
  }

  // Regex pour les routes dynamiques nécessitant des traductions spécifiques
  const dynamicRoutePatterns: Array<{ pattern: RegExp; translations: string[] }> = [
    {
      pattern: /^\/editions\/\d+\/gestion\/ticketing/,
      translations: ['ticketing'],
    },
  ]

  // Déterminer quels fichiers de traduction charger
  const translationsToLoad: string[] = []

  // Vérifier les routes statiques
  for (const [route, translations] of Object.entries(routeTranslations)) {
    if (to.path.startsWith(route)) {
      translationsToLoad.push(...translations)
    }
  }

  // Vérifier les routes dynamiques avec regex
  for (const { pattern, translations } of dynamicRoutePatterns) {
    if (pattern.test(to.path)) {
      translationsToLoad.push(...translations)
    }
  }

  // Charger les traductions nécessaires
  if (translationsToLoad.length > 0) {
    try {
      // Éviter de charger plusieurs fois les mêmes traductions
      const loadedKey = `_loaded_${locale}`
      if (!(nuxtApp as any)[loadedKey]) {
        ;(nuxtApp as any)[loadedKey] = new Set()
      }

      for (const translationFile of translationsToLoad) {
        // Vérifier si déjà chargé
        if ((nuxtApp as any)[loadedKey].has(translationFile)) {
          continue
        }

        // Charger les traductions via le loader statique
        const loader = translationLoaders[translationFile]?.[locale]
        if (loader) {
          const messages = await loader().then((m) => m.default || m)

          // Fusionner avec les messages existants
          i18n.mergeLocaleMessage(locale, messages)

          // Marquer comme chargé
          ;(nuxtApp as any)[loadedKey].add(translationFile)
        }
      }
    } catch (error) {
      console.error(`Erreur lors du chargement des traductions pour ${to.path}:`, error)
    }
  }
})
