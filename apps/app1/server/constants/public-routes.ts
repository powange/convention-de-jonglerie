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
  { path: '/api/auth/accept-invitation', methods: ['POST'] },
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

  // ====== Remontée des clés i18n manquantes (anonyme ou authentifié) ======
  { path: '/api/i18n/missing-keys', methods: ['POST'], hydrateSession: true },

  // ====== API publique (authentifiée par token, pas par session) ======
  // Le contrôle d'accès est fait dans le handler via le token d'API.
  { prefix: '/api/public/', methods: ['GET'] },

  // ====== Listes publiques ======
  { path: '/api/conventions', methods: ['GET'] },
  { path: '/api/editions', methods: ['GET'] },
  { path: '/api/__sitemap__/editions', methods: ['GET'] },
  { path: '/api/__sitemap__/carpool', methods: ['GET'] },
  { path: '/api/__sitemap__/volunteers', methods: ['GET'] },
  { path: '/api/countries', methods: ['GET'] },

  // ====== Fichiers statiques ======
  { prefix: '/api/uploads/', methods: ['GET'] },

  // ====== Éditions en cours géolocalisées ======
  // Publique : un visiteur non connecté a autant besoin d'être orienté vers l'édition où il se
  // trouve. La session est hydratée quand elle existe, pour savoir s'il y est bénévole accepté.
  {
    path: '/api/editions/en-cours-localisees',
    methods: ['GET'],
    hydrateSession: true,
  },

  // ====== Détails convention / édition ======
  { pattern: /^\/api\/conventions\/\d+$/, methods: ['GET'], hydrateSession: true },
  { pattern: /^\/api\/editions\/\d+$/, methods: ['GET'], hydrateSession: true },

  // ====== Covoiturage ======
  { pattern: /^\/api\/editions\/\d+\/carpool-offers$/, methods: ['GET'], hydrateSession: true },
  { pattern: /^\/api\/editions\/\d+\/carpool-requests$/, methods: ['GET'], hydrateSession: true },
  { pattern: /^\/api\/carpool-offers\/\d+\/comments$/, methods: ['GET'], hydrateSession: true },
  { pattern: /^\/api\/carpool-requests\/\d+\/comments$/, methods: ['GET'], hydrateSession: true },
  /*
   * Le DÉTAIL d'une offre et d'une demande, qui manquaient.
   *
   * ⚠️ Les listes étaient publiques, et leurs cartes mènent au détail : un visiteur non connecté
   * cliquait donc une carte et lisait « Offre de covoiturage introuvable ». Ce n'était pas une
   * absence de donnée mais un 401 du middleware, déguisé par l'écran en « introuvable ».
   *
   * `hydrateSession` comme les listes : le transform masque déjà le téléphone hors session, et
   * c'est lui qui décide de ce qu'un anonyme voit. Sans l'hydratation, un visiteur CONNECTÉ
   * perdrait ce que sa session lui donne — son propre téléphone sur sa propre offre.
   */
  { pattern: /^\/api\/carpool-offers\/\d+$/, methods: ['GET'], hydrateSession: true },
  { pattern: /^\/api\/carpool-requests\/\d+$/, methods: ['GET'], hydrateSession: true },

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
  // Frise du programme (ateliers, spectacles, éléments libres). La session est hydratée pour
  // que les organisateurs y voient aussi leurs brouillons ; un visiteur n'a que le publié.
  { pattern: /^\/api\/editions\/\d+\/program$/, methods: ['GET'], hydrateSession: true },
  { pattern: /^\/api\/editions\/\d+\/markers$/, methods: ['GET'], hydrateSession: true },
  /*
   * Export KML de la carte, pour ouvrir le plan dans Google Earth ou une application de
   * randonnée — sur place, souvent hors réseau.
   *
   * ⚠️ IL ÉTAIT INATTEIGNABLE. Le handler est écrit pour le public : il vérifie la publication de
   * la carte et pose un `Content-Disposition`. Mais la route n'était pas inscrite ici, donc le
   * middleware répondait 401 à tout visiteur AVANT même d'atteindre cette vérification. Et aucun
   * écran ne proposait le lien : la fonctionnalité existait, était testée pour l'accès public, et
   * n'était offerte nulle part.
   *
   * `hydrateSession` comme les zones et les marqueurs : la même garde décide, et elle laisse
   * l'organisation exporter sa propre carte avant publication.
   */
  { pattern: /^\/api\/editions\/\d+\/export\.kml$/, methods: ['GET'], hydrateSession: true },

  // ====== FAQ (entrées publiques) ======
  { pattern: /^\/api\/editions\/\d+\/faq$/, methods: ['GET'], hydrateSession: true },

  // ====== Coûts du projet & donations ======
  { path: '/api/project-costs', methods: ['GET'] },
  { path: '/api/project-costs/donations', methods: ['GET'] },
  { path: '/api/project-costs/checkout', methods: ['POST'] },
  { path: '/api/project-costs/webhook', methods: ['POST'] },
]

/**
 * Cette route est-elle publique pour cette méthode ?
 *
 * Extraite du middleware pour être vérifiable : la règle qui décide, pour chaque requête, entre
 * « ouvert à tous » et « 401 » ne pouvait pas être éprouvée tant qu'elle vivait dans un
 * `defineEventHandler`. Or elle porte deux risques opposés — un oubli ferme un endpoint public,
 * une entrée trop large en ouvre d'autres —, et les tests d'endpoints, qui appellent les
 * handlers directement, ne franchissent jamais ce middleware.
 *
 * @param path Chemin sans la chaîne de requête.
 * @param method Méthode HTTP, telle que reçue.
 */
export function trouverRoutePublique(
  path: string,
  method: string | undefined
): PublicRoute | undefined {
  return publicRoutes.find((route) => {
    if (!method || !route.methods.includes(method)) return false
    if ('prefix' in route) return path.startsWith(route.prefix)
    if ('pattern' in route) return route.pattern.test(path)
    return route.path === path
  })
}
