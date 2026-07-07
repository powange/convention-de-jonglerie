import type { H3Event } from 'h3'

/**
 * Rate limiting en mémoire (autonome, sans dépendance externe).
 *
 * En production multi-instances, préférer un backend partagé (Redis). Ici,
 * une simple Map suffit pour app2. Chaque limiteur est une fonction
 * `(event: H3Event) => Promise<void>` qui throw une erreur 429 au-delà du seuil.
 */

interface RateLimitConfig {
  /** Fenêtre de temps en millisecondes */
  windowMs: number
  /** Nombre maximum de requêtes par fenêtre */
  max: number
  /** Message d'erreur personnalisé */
  message?: string
  /** Fonction pour générer la clé unique (par défaut : IP + route) */
  keyGenerator?: (event: H3Event) => string
}

// Stockage en mémoire des tentatives
const attempts = new Map<string, { count: number; resetTime: number }>()

// Nettoyer les entrées expirées toutes les 10 minutes
const cleanupInterval = setInterval(
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
// Ne pas empêcher le process de s'arrêter à cause du timer (best-effort)
;(cleanupInterval as { unref?: () => void }).unref?.()

// Seuils relevés en dev / tests E2E pour ne pas gêner
const DEV = import.meta.dev || process.env.E2E_TEST === 'true'

function getClientKey(event: H3Event): string {
  const ip =
    (event.node.req.headers['x-forwarded-for'] as string) ||
    event.node.req.socket.remoteAddress ||
    'unknown'
  return `${ip}:${event.path}`
}

/**
 * Fabrique un middleware de rate limiting sur une fenêtre glissante.
 */
export function createRateLimiter(config: RateLimitConfig) {
  const { windowMs, max, message = 'Trop de requêtes', keyGenerator = getClientKey } = config

  return async (event: H3Event): Promise<void> => {
    const key = keyGenerator(event)
    const now = Date.now()

    let record = attempts.get(key)

    if (!record || record.resetTime < now) {
      // Nouvelle fenêtre de temps
      attempts.set(key, { count: 1, resetTime: now + windowMs })
      return
    }

    record.count++

    if (record.count > max) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000)
      throw createError({
        statusCode: 429,
        statusMessage: 'Trop de requêtes',
        message,
        data: {
          retryAfter,
          resetTime: new Date(record.resetTime).toISOString(),
        },
      })
    }
  }
}

/** Authentification : 5 tentatives / minute / IP */
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: DEV ? 100 : 5,
  message: 'Trop de tentatives de connexion, veuillez réessayer dans une minute',
})

/** Inscription : 3 comptes / heure / IP */
export const registerRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: DEV ? 100 : 3,
  message: 'Trop de créations de compte, veuillez réessayer plus tard',
})

/** Vérification de codes (6 chiffres) : 5 tentatives / 15 minutes / IP */
export const verificationCodeRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: DEV ? 100 : 5,
  message: 'Trop de tentatives de vérification, veuillez réessayer dans 15 minutes',
})

/** Vérification d'existence d'email : 10 requêtes / minute / IP */
export const checkEmailRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: DEV ? 100 : 10,
  message: 'Trop de requêtes, veuillez réessayer plus tard',
})

/** Envoi d'email (renvoi de code) : 3 emails / 15 minutes / email */
export const emailRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: DEV ? 100 : 3,
  message: "Trop d'envois d'email, veuillez réessayer plus tard",
  keyGenerator: (event: H3Event) => {
    const body = event.context.body as { email?: string } | undefined
    const user = event.context.user as { id?: number | string } | undefined
    return String(body?.email || user?.id || 'unknown')
  },
})

/** Demande de reset de mot de passe : 3 demandes / 15 minutes / IP */
export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: DEV ? 100 : 3,
  message: 'Trop de demandes de réinitialisation, veuillez réessayer plus tard',
})
