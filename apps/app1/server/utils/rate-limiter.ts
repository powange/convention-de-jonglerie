import type { H3Event } from 'h3'

interface RateLimitConfig {
  windowMs: number // Fenêtre de temps en millisecondes
  max: number // Nombre maximum de requêtes par fenêtre
  message?: string // Message d'erreur personnalisé
  keyGenerator?: (event: H3Event) => string // Fonction pour générer la clé unique
}

// Stockage en mémoire des tentatives (en production, utiliser Redis)
const attempts = new Map<string, { count: number; resetTime: number }>()

// Nettoyer les entrées expirées toutes les 10 minutes
setInterval(
  () => {
    const now = Date.now()
    for (const [key, value] of attempts.entries()) {
      if (value.resetTime < now) {
        attempts.delete(key)
      }
    }
  },
  10 * 60 * 1000
)

/**
 * Middleware de rate limiting
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    max,
    message = 'Trop de requêtes, veuillez réessayer plus tard',
    keyGenerator = (event: H3Event) => {
      // Par défaut, utiliser l'IP + la route
      const ip =
        event.node.req.headers['x-forwarded-for'] ||
        event.node.req.socket.remoteAddress ||
        'unknown'
      return `${ip}:${event.path}`
    },
  } = config

  return async (event: H3Event) => {
    const key = keyGenerator(event)
    const now = Date.now()

    // Récupérer ou initialiser les données pour cette clé
    let record = attempts.get(key)

    if (!record || record.resetTime < now) {
      // Nouvelle fenêtre de temps
      record = {
        count: 1,
        resetTime: now + windowMs,
      }
      attempts.set(key, record)
      return // Première tentative, on laisse passer
    }

    // Incrémenter le compteur
    record.count++

    // Vérifier si la limite est atteinte
    if (record.count > max) {
      // Calculer le temps restant avant reset
      const retryAfter = Math.ceil((record.resetTime - now) / 1000)

      throw createError({
        status: 429,
        message: message,
        data: {
          retryAfter, // Temps en secondes avant de pouvoir réessayer
          resetTime: new Date(record.resetTime).toISOString(),
        },
      })
    }
  }
}

/**
 * Rate limiter pré-configuré pour l'authentification
 * 5 tentatives par minute par IP
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: import.meta.dev || process.env.E2E_TEST === 'true' ? 100 : 5,
  message: 'Trop de tentatives de connexion, veuillez réessayer dans une minute',
})

/**
 * Rate limiter pré-configuré pour l'inscription
 * 3 comptes par heure par IP (100 en dev/E2E pour les tests)
 */
export const registerRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: import.meta.dev || process.env.E2E_TEST === 'true' ? 100 : 3,
  message: 'Trop de créations de compte, veuillez réessayer plus tard',
})

/**
 * Rate limiter pré-configuré pour la vérification de codes (6 chiffres)
 * 5 tentatives par 15 minutes par IP (protection brute force sur codes courts)
 */
export const verificationCodeRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: import.meta.dev || process.env.E2E_TEST === 'true' ? 100 : 5,
  message: 'Trop de tentatives de vérification, veuillez réessayer dans 15 minutes',
})

/**
 * Rate limiter pré-configuré pour la vérification d'existence d'emails
 * 10 requêtes par minute par IP (protection enumeration)
 */
export const checkEmailRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: import.meta.dev || process.env.E2E_TEST === 'true' ? 100 : 10,
  message: 'Trop de requêtes, veuillez réessayer plus tard',
})

/**
 * Rate limiter pré-configuré pour l'envoi d'emails
 * 3 emails par 15 minutes par utilisateur
 * Note : nécessite que `event.context.user` soit défini (utilisateur authentifié)
 *        ou `event.context.body.email` (rarement rempli avant readBody)
 */
export const emailRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  message: "Trop d'envois d'email, veuillez réessayer plus tard",
  keyGenerator: (event: H3Event) => {
    // Utiliser l'email ou l'ID utilisateur si disponible
    const body = event.context.body
    const user = event.context.user
    return body?.email || user?.id || 'unknown'
  },
})

/**
 * Rate limiter pré-configuré pour les demandes de reset de mot de passe
 * 3 demandes par 15 minutes par IP (utilisateur non authentifié → clé IP)
 */
export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: import.meta.dev || process.env.E2E_TEST === 'true' ? 100 : 3,
  message: 'Trop de demandes de réinitialisation, veuillez réessayer plus tard',
})
