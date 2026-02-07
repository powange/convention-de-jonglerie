/**
 * Configuration déclarative des routes publiques de l'API.
 *
 * Chaque route publique déclare :
 * - Un matcher : `path` (exact), `pattern` (regex), ou `prefix` (startsWith)
 * - Les méthodes HTTP autorisées
 * - `hydrateSession` (optionnel) : si true, la session est chargée (sans bloquer)
 *   pour permettre un rendu conditionnel côté API (ex: données visibles si authentifié)
 *
 * Toute route /api/* absente de cette liste est protégée (401 si pas de session).
 */

// --- Types ---

interface PublicRouteExact {
  path: string
  methods: string[]
  hydrateSession?: boolean
}

interface PublicRoutePattern {
  pattern: RegExp
  methods: string[]
  hydrateSession?: boolean
}

interface PublicRoutePrefix {
  prefix: string
  methods: string[]
}

export type PublicRoute = PublicRouteExact | PublicRoutePattern | PublicRoutePrefix

// --- Configuration ---

export const publicRoutes: PublicRoute[] = [
  // ====== Nuxt internals ======
  { prefix: '/api/_nuxt_icon/', methods: ['GET'] },
  { path: '/api/site.webmanifest', methods: ['GET'] },

  // ====== Authentification ======
  { path: '/api/auth/register', methods: ['POST'] },
  { path: '/api/auth/login', methods: ['POST'] },
  { path: '/api/auth/verify-email', methods: ['POST'] },
  { path: '/api/auth/set-password-and-verify', methods: ['POST'] },
  { path: '/api/auth/resend-verification', methods: ['POST'] },
  { path: '/api/auth/request-password-reset', methods: ['POST'] },
  { path: '/api/auth/reset-password', methods: ['POST'] },
  { path: '/api/auth/check-email', methods: ['POST'] },
  { path: '/api/auth/verify-reset-token', methods: ['GET'] },

  // ====== OAuth callbacks ======
  { path: '/auth/google', methods: ['GET'] },
  { path: '/auth/facebook', methods: ['GET'] },

  // ====== Feedback (anonyme ou authentifié) ======
  { path: '/api/feedback', methods: ['POST'], hydrateSession: true },

  // ====== Listes publiques ======
  { path: '/api/conventions', methods: ['GET'] },
  { path: '/api/editions', methods: ['GET'] },
  { path: '/api/__sitemap__/editions', methods: ['GET'] },
  { path: '/api/countries', methods: ['GET'] },

  // ====== Fichiers statiques ======
  { prefix: '/api/uploads/', methods: ['GET'] },

  // ====== Détails convention / édition ======
  { pattern: /^\/api\/conventions\/\d+$/, methods: ['GET'], hydrateSession: true },
  { pattern: /^\/api\/editions\/\d+$/, methods: ['GET'], hydrateSession: true },

  // ====== Covoiturage ======
  { pattern: /^\/api\/editions\/\d+\/carpool-offers$/, methods: ['GET'], hydrateSession: true },
  { pattern: /^\/api\/editions\/\d+\/carpool-requests$/, methods: ['GET'], hydrateSession: true },
  { pattern: /^\/api\/carpool-offers\/\d+\/comments$/, methods: ['GET'], hydrateSession: true },
  { pattern: /^\/api\/carpool-requests\/\d+\/comments$/, methods: ['GET'], hydrateSession: true },

  // ====== Posts d'édition ======
  { pattern: /^\/api\/editions\/\d+\/posts$/, methods: ['GET'], hydrateSession: true },

  // ====== Bénévoles (info publique) ======
  { pattern: /^\/api\/editions\/\d+\/volunteers\/info$/, methods: ['GET'], hydrateSession: true },
  {
    pattern: /^\/api\/editions\/\d+\/volunteers\/settings$/,
    methods: ['GET'],
    hydrateSession: true,
  },

  // ====== Billetterie (tarifs publics) ======
  {
    pattern: /^\/api\/editions\/\d+\/ticketing\/tiers\/public$/,
    methods: ['GET'],
    hydrateSession: true,
  },

  // ====== Appels à spectacles ======
  { pattern: /^\/api\/editions\/\d+\/shows-call\/public$/, methods: ['GET'], hydrateSession: true },
  {
    pattern: /^\/api\/editions\/\d+\/shows-call\/\d+\/public$/,
    methods: ['GET'],
    hydrateSession: true,
  },

  // ====== Carte (zones et marqueurs) ======
  { pattern: /^\/api\/editions\/\d+\/zones$/, methods: ['GET'], hydrateSession: true },
  { pattern: /^\/api\/editions\/\d+\/markers$/, methods: ['GET'], hydrateSession: true },
]
