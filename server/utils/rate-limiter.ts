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
  max: 5,
  message: 'Trop de tentatives de connexion, veuillez réessayer dans une minute',
})

/**
 * Rate limiter pré-configuré pour l'inscription
 * 3 comptes par heure par IP
 */
export const registerRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 3,
  message: 'Trop de créations de compte, veuillez réessayer plus tard',
})

/**
 * Rate limiter pré-configuré pour l'envoi d'emails
 * 3 emails par 15 minutes par utilisateur
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
