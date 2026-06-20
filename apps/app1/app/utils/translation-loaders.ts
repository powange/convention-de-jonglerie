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
    '/admin': ['admin', 'auth', 'profil'],
    '/editions': ['edition'],
    '/project-costs': ['project-costs'],
    '/auth': ['auth', 'profil'],
    '/login': ['auth'],
    '/register': ['auth', 'profil'],
    '/profile': ['auth', 'profil'],
    '/verify-email': ['auth'],
    '/welcome': ['auth', 'profil'],
    '/messenger': ['messenger'],
  }

  // Vérifier les routes statiques
  for (const [route, translations] of Object.entries(routeTranslations)) {
    if (path.startsWith(route)) {
      translationsToLoad.push(...translations)
    }
  }

  // Routes dynamiques avec regex.
  // Plusieurs patterns peuvent matcher la même URL : leurs traductions sont
  // cumulées. Utiliser des patterns « add-on » (sans namespace dupliqué) pour
  // les sous-routes qui chargent un namespace supplémentaire.
  const dynamicRoutePatterns: Array<{ pattern: RegExp; translations: string[] }> = [
    // Toutes les pages /gestion/* chargent le namespace gestion.
    // (Le layout edition-dashboard référence gestion.shows_call.title et
    // .list_description, qui restent dans gestion.json — buckets de nav.)
    {
      pattern: /^\/editions\/\d+\/gestion/,
      translations: ['gestion'],
    },
    // Vue d'ensemble racine : workshops (cartes de modules). Le libellé de la carte
    // « tâches » vit dans le domaine gestion (gestion.task.manage_*), déjà chargé.
    {
      pattern: /^\/editions\/\d+\/gestion$/,
      translations: ['workshops'],
    },
    // Gestion des tâches : domaine tasks (partagé) + gestion-tasks (clés management)
    {
      pattern: /^\/editions\/\d+\/gestion\/tasks/,
      translations: ['tasks', 'gestion-tasks'],
    },
    // Gestion de la carte : domaine map (partagé) + gestion-map (clés d'édition)
    {
      pattern: /^\/editions\/\d+\/gestion\/map/,
      translations: ['map', 'gestion-map'],
    },
    // Gestion bénévoles : domaine volunteers (partagé) + gestion-volunteers (management)
    {
      pattern: /^\/editions\/\d+\/gestion\/volunteers/,
      translations: ['volunteers', 'gestion-volunteers'],
    },
    // Add-ons par sous-section
    {
      pattern: /^\/editions\/\d+\/gestion\/ticketing/,
      translations: ['ticketing'],
    },
    {
      pattern: /^\/editions\/\d+\/gestion\/workshops/,
      translations: ['workshops'],
    },
    {
      pattern: /^\/editions\/\d+\/gestion\/artists/,
      translations: ['artists'],
    },
    // Gestion appel à spectacles : survey (sondages) + shows-call (clés publiques
    // partagées shows_call.*) + gestion-shows-call (détail management gestion.shows_call.*)
    {
      pattern: /^\/editions\/\d+\/gestion\/shows-call/,
      translations: ['survey', 'shows-call', 'gestion-shows-call'],
    },
    // Routes hors /gestion
    // Page « Mes tâches » (utilisateur) : réutilise le module de tâches
    {
      pattern: /^\/editions\/\d+\/my-tasks/,
      translations: ['tasks'],
    },
    // Carte publique : clés UI carte partagées
    {
      pattern: /^\/editions\/\d+\/map/,
      translations: ['map'],
    },
    // Bénévolat public (page d'inscription/candidature) : domaine volunteers partagé
    {
      pattern: /^\/editions\/\d+\/volunteers/,
      translations: ['volunteers'],
    },
    // Appel à spectacles public (liste, détail, candidature) : namespace public
    // shows_call.* (shows-call.json), partagé avec la gestion. Les clés de détail
    // gestion (gestion.shows_call.*) ne sont PAS chargées ici.
    {
      pattern: /^\/editions\/\d+\/shows-call/,
      translations: ['shows-call'],
    },
    // Profil : page « Mes candidatures bénévole » réutilise le domaine volunteers
    {
      pattern: /^\/profile\/mes-candidatures-benevole/,
      translations: ['volunteers'],
    },
    {
      pattern: /^\/survey\//,
      translations: ['survey'],
    },
    {
      pattern: /^\/editions\/\d+\/artist-space/,
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
  tasks: {
    en: () => import('~~/i18n/locales/en/tasks.json'),
    da: () => import('~~/i18n/locales/da/tasks.json'),
    de: () => import('~~/i18n/locales/de/tasks.json'),
    es: () => import('~~/i18n/locales/es/tasks.json'),
    fr: () => import('~~/i18n/locales/fr/tasks.json'),
    it: () => import('~~/i18n/locales/it/tasks.json'),
    nl: () => import('~~/i18n/locales/nl/tasks.json'),
    pl: () => import('~~/i18n/locales/pl/tasks.json'),
    pt: () => import('~~/i18n/locales/pt/tasks.json'),
    ru: () => import('~~/i18n/locales/ru/tasks.json'),
    uk: () => import('~~/i18n/locales/uk/tasks.json'),
    cs: () => import('~~/i18n/locales/cs/tasks.json'),
    sv: () => import('~~/i18n/locales/sv/tasks.json'),
  },
  // Clés de tâches utilisées uniquement côté gestion (namespace gestion.task.*)
  'gestion-tasks': {
    en: () => import('~~/i18n/locales/en/gestion-tasks.json'),
    da: () => import('~~/i18n/locales/da/gestion-tasks.json'),
    de: () => import('~~/i18n/locales/de/gestion-tasks.json'),
    es: () => import('~~/i18n/locales/es/gestion-tasks.json'),
    fr: () => import('~~/i18n/locales/fr/gestion-tasks.json'),
    it: () => import('~~/i18n/locales/it/gestion-tasks.json'),
    nl: () => import('~~/i18n/locales/nl/gestion-tasks.json'),
    pl: () => import('~~/i18n/locales/pl/gestion-tasks.json'),
    pt: () => import('~~/i18n/locales/pt/gestion-tasks.json'),
    ru: () => import('~~/i18n/locales/ru/gestion-tasks.json'),
    uk: () => import('~~/i18n/locales/uk/gestion-tasks.json'),
    cs: () => import('~~/i18n/locales/cs/gestion-tasks.json'),
    sv: () => import('~~/i18n/locales/sv/gestion-tasks.json'),
  },
  // Clés UI de la carte (partagées public + gestion, namespace map.*)
  map: {
    en: () => import('~~/i18n/locales/en/map.json'),
    da: () => import('~~/i18n/locales/da/map.json'),
    de: () => import('~~/i18n/locales/de/map.json'),
    es: () => import('~~/i18n/locales/es/map.json'),
    fr: () => import('~~/i18n/locales/fr/map.json'),
    it: () => import('~~/i18n/locales/it/map.json'),
    nl: () => import('~~/i18n/locales/nl/map.json'),
    pl: () => import('~~/i18n/locales/pl/map.json'),
    pt: () => import('~~/i18n/locales/pt/map.json'),
    ru: () => import('~~/i18n/locales/ru/map.json'),
    uk: () => import('~~/i18n/locales/uk/map.json'),
    cs: () => import('~~/i18n/locales/cs/map.json'),
    sv: () => import('~~/i18n/locales/sv/map.json'),
  },
  // Clés d'édition de la carte (uniquement côté gestion, namespace gestion.map.*)
  'gestion-map': {
    en: () => import('~~/i18n/locales/en/gestion-map.json'),
    da: () => import('~~/i18n/locales/da/gestion-map.json'),
    de: () => import('~~/i18n/locales/de/gestion-map.json'),
    es: () => import('~~/i18n/locales/es/gestion-map.json'),
    fr: () => import('~~/i18n/locales/fr/gestion-map.json'),
    it: () => import('~~/i18n/locales/it/gestion-map.json'),
    nl: () => import('~~/i18n/locales/nl/gestion-map.json'),
    pl: () => import('~~/i18n/locales/pl/gestion-map.json'),
    pt: () => import('~~/i18n/locales/pt/gestion-map.json'),
    ru: () => import('~~/i18n/locales/ru/gestion-map.json'),
    uk: () => import('~~/i18n/locales/uk/gestion-map.json'),
    cs: () => import('~~/i18n/locales/cs/gestion-map.json'),
    sv: () => import('~~/i18n/locales/sv/gestion-map.json'),
  },
  // Clés bénévoles partagées (public + gestion, namespace volunteers.*)
  volunteers: {
    en: () => import('~~/layers/volunteers/i18n/locales/en/volunteers.json'),
    da: () => import('~~/layers/volunteers/i18n/locales/da/volunteers.json'),
    de: () => import('~~/layers/volunteers/i18n/locales/de/volunteers.json'),
    es: () => import('~~/layers/volunteers/i18n/locales/es/volunteers.json'),
    fr: () => import('~~/layers/volunteers/i18n/locales/fr/volunteers.json'),
    it: () => import('~~/layers/volunteers/i18n/locales/it/volunteers.json'),
    nl: () => import('~~/layers/volunteers/i18n/locales/nl/volunteers.json'),
    pl: () => import('~~/layers/volunteers/i18n/locales/pl/volunteers.json'),
    pt: () => import('~~/layers/volunteers/i18n/locales/pt/volunteers.json'),
    ru: () => import('~~/layers/volunteers/i18n/locales/ru/volunteers.json'),
    uk: () => import('~~/layers/volunteers/i18n/locales/uk/volunteers.json'),
    cs: () => import('~~/layers/volunteers/i18n/locales/cs/volunteers.json'),
    sv: () => import('~~/layers/volunteers/i18n/locales/sv/volunteers.json'),
  },
  // Clés de gestion bénévoles (uniquement côté gestion, namespace gestion.volunteers.*)
  'gestion-volunteers': {
    en: () => import('~~/layers/volunteers/i18n/locales/en/gestion-volunteers.json'),
    da: () => import('~~/layers/volunteers/i18n/locales/da/gestion-volunteers.json'),
    de: () => import('~~/layers/volunteers/i18n/locales/de/gestion-volunteers.json'),
    es: () => import('~~/layers/volunteers/i18n/locales/es/gestion-volunteers.json'),
    fr: () => import('~~/layers/volunteers/i18n/locales/fr/gestion-volunteers.json'),
    it: () => import('~~/layers/volunteers/i18n/locales/it/gestion-volunteers.json'),
    nl: () => import('~~/layers/volunteers/i18n/locales/nl/gestion-volunteers.json'),
    pl: () => import('~~/layers/volunteers/i18n/locales/pl/gestion-volunteers.json'),
    pt: () => import('~~/layers/volunteers/i18n/locales/pt/gestion-volunteers.json'),
    ru: () => import('~~/layers/volunteers/i18n/locales/ru/gestion-volunteers.json'),
    uk: () => import('~~/layers/volunteers/i18n/locales/uk/gestion-volunteers.json'),
    cs: () => import('~~/layers/volunteers/i18n/locales/cs/gestion-volunteers.json'),
    sv: () => import('~~/layers/volunteers/i18n/locales/sv/gestion-volunteers.json'),
  },
  'project-costs': {
    en: () => import('~~/i18n/locales/en/project-costs.json'),
    da: () => import('~~/i18n/locales/da/project-costs.json'),
    de: () => import('~~/i18n/locales/de/project-costs.json'),
    es: () => import('~~/i18n/locales/es/project-costs.json'),
    fr: () => import('~~/i18n/locales/fr/project-costs.json'),
    it: () => import('~~/i18n/locales/it/project-costs.json'),
    nl: () => import('~~/i18n/locales/nl/project-costs.json'),
    pl: () => import('~~/i18n/locales/pl/project-costs.json'),
    pt: () => import('~~/i18n/locales/pt/project-costs.json'),
    ru: () => import('~~/i18n/locales/ru/project-costs.json'),
    uk: () => import('~~/i18n/locales/uk/project-costs.json'),
    cs: () => import('~~/i18n/locales/cs/project-costs.json'),
    sv: () => import('~~/i18n/locales/sv/project-costs.json'),
  },
  messenger: {
    en: () => import('~~/i18n/locales/en/messenger.json'),
    da: () => import('~~/i18n/locales/da/messenger.json'),
    de: () => import('~~/i18n/locales/de/messenger.json'),
    es: () => import('~~/i18n/locales/es/messenger.json'),
    fr: () => import('~~/i18n/locales/fr/messenger.json'),
    it: () => import('~~/i18n/locales/it/messenger.json'),
    nl: () => import('~~/i18n/locales/nl/messenger.json'),
    pl: () => import('~~/i18n/locales/pl/messenger.json'),
    pt: () => import('~~/i18n/locales/pt/messenger.json'),
    ru: () => import('~~/i18n/locales/ru/messenger.json'),
    uk: () => import('~~/i18n/locales/uk/messenger.json'),
    cs: () => import('~~/i18n/locales/cs/messenger.json'),
    sv: () => import('~~/i18n/locales/sv/messenger.json'),
  },
  survey: {
    en: () => import('~~/i18n/locales/en/survey.json'),
    da: () => import('~~/i18n/locales/da/survey.json'),
    de: () => import('~~/i18n/locales/de/survey.json'),
    es: () => import('~~/i18n/locales/es/survey.json'),
    fr: () => import('~~/i18n/locales/fr/survey.json'),
    it: () => import('~~/i18n/locales/it/survey.json'),
    nl: () => import('~~/i18n/locales/nl/survey.json'),
    pl: () => import('~~/i18n/locales/pl/survey.json'),
    pt: () => import('~~/i18n/locales/pt/survey.json'),
    ru: () => import('~~/i18n/locales/ru/survey.json'),
    uk: () => import('~~/i18n/locales/uk/survey.json'),
    cs: () => import('~~/i18n/locales/cs/survey.json'),
    sv: () => import('~~/i18n/locales/sv/survey.json'),
  },
  // Appel à spectacles — clés publiques partagées (namespace shows_call.*),
  // utilisées par les pages publiques ET la gestion (liste, détail, candidature).
  'shows-call': {
    en: () => import('~~/i18n/locales/en/shows-call.json'),
    da: () => import('~~/i18n/locales/da/shows-call.json'),
    de: () => import('~~/i18n/locales/de/shows-call.json'),
    es: () => import('~~/i18n/locales/es/shows-call.json'),
    fr: () => import('~~/i18n/locales/fr/shows-call.json'),
    it: () => import('~~/i18n/locales/it/shows-call.json'),
    nl: () => import('~~/i18n/locales/nl/shows-call.json'),
    pl: () => import('~~/i18n/locales/pl/shows-call.json'),
    pt: () => import('~~/i18n/locales/pt/shows-call.json'),
    ru: () => import('~~/i18n/locales/ru/shows-call.json'),
    uk: () => import('~~/i18n/locales/uk/shows-call.json'),
    cs: () => import('~~/i18n/locales/cs/shows-call.json'),
    sv: () => import('~~/i18n/locales/sv/shows-call.json'),
  },
  // Appel à spectacles — clés de détail/management (namespace gestion.shows_call.*),
  // chargées uniquement sur /editions/:id/gestion/shows-call/*
  'gestion-shows-call': {
    en: () => import('~~/i18n/locales/en/gestion-shows-call.json'),
    da: () => import('~~/i18n/locales/da/gestion-shows-call.json'),
    de: () => import('~~/i18n/locales/de/gestion-shows-call.json'),
    es: () => import('~~/i18n/locales/es/gestion-shows-call.json'),
    fr: () => import('~~/i18n/locales/fr/gestion-shows-call.json'),
    it: () => import('~~/i18n/locales/it/gestion-shows-call.json'),
    nl: () => import('~~/i18n/locales/nl/gestion-shows-call.json'),
    pl: () => import('~~/i18n/locales/pl/gestion-shows-call.json'),
    pt: () => import('~~/i18n/locales/pt/gestion-shows-call.json'),
    ru: () => import('~~/i18n/locales/ru/gestion-shows-call.json'),
    uk: () => import('~~/i18n/locales/uk/gestion-shows-call.json'),
    cs: () => import('~~/i18n/locales/cs/gestion-shows-call.json'),
    sv: () => import('~~/i18n/locales/sv/gestion-shows-call.json'),
  },
  profil: {
    en: () => import('~~/i18n/locales/en/profil.json'),
    da: () => import('~~/i18n/locales/da/profil.json'),
    de: () => import('~~/i18n/locales/de/profil.json'),
    es: () => import('~~/i18n/locales/es/profil.json'),
    fr: () => import('~~/i18n/locales/fr/profil.json'),
    it: () => import('~~/i18n/locales/it/profil.json'),
    nl: () => import('~~/i18n/locales/nl/profil.json'),
    pl: () => import('~~/i18n/locales/pl/profil.json'),
    pt: () => import('~~/i18n/locales/pt/profil.json'),
    ru: () => import('~~/i18n/locales/ru/profil.json'),
    uk: () => import('~~/i18n/locales/uk/profil.json'),
    cs: () => import('~~/i18n/locales/cs/profil.json'),
    sv: () => import('~~/i18n/locales/sv/profil.json'),
  },
}
