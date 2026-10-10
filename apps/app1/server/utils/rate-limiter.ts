import { sanitizeEmail } from './validation-helpers'

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
 * L'adresse du client, derrière le proxy s'il y en a un.
 *
 * ⚠️ ÉCRITE UNE FOIS. Cette expression existait en quatre copies — le limiteur par défaut, celui du
 * paiement, celui de la recherche, celui des recherches de personnes — et elles ne faisaient pas
 * tout à fait la même chose : le limiteur par défaut ne découpait PAS `x-forwarded-for` sur la
 * virgule, alors que cet en-tête porte la chaîne complète des relais (`client, proxy1, proxy2`).
 * Sa clé variait donc avec le chemin suivi par la requête, et le même visiteur pouvait obtenir
 * plusieurs compteurs.
 */
export function adresseDuClient(event: H3Event): string {
  const transmise = String(event.node.req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    ?.trim()
  return transmise || event.node.req.socket.remoteAddress || 'unknown'
}

/**
 * Middleware de rate limiting
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    max,
    message = 'Trop de requêtes, veuillez réessayer plus tard',
    // Par défaut, l'adresse du client + la route
    keyGenerator = (event: H3Event) => `${adresseDuClient(event)}:${event.path}`,
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
/**
 * L'adresse visée par un envoi, normalisée — ou `'-'` si la requête n'en annonce pas.
 *
 * ⚠️ `typeof === 'string'` EST INDISPENSABLE. La clé était `body?.email` brut : un corps portant
 * `{ email: { toString: … } }` ou un tableau donnait la clé `'[object Object]'`, **partagée par
 * tous** — trois envois par quart d'heure consommés par le premier venu.
 *
 * La normalisation, elle, ferme l'autre moitié : « A@x.fr » et « a@x.fr » ouvraient deux compteurs
 * distincts pour la même boîte.
 */
function adresseViseeParLEnvoi(event: H3Event): string {
  const brut = (event.context.body as { email?: unknown } | undefined)?.email
  return typeof brut === 'string' && brut.trim() ? sanitizeEmail(brut) : '-'
}

/**
 * Trois envois par quart d'heure, par COUPLE (adresse du client, adresse visée).
 *
 * ## ⚠️ CE QUE LA CLÉ ÉTAIT, ET POURQUOI C'ÉTAIT UN TROU (constat B7)
 *
 * `body?.email || user?.id || 'unknown'` — c'est-à-dire l'adresse **visée**, jamais l'expéditeur.
 * Trois conséquences, et la fiche n'en nommait que deux :
 *
 * 1. Une même machine pouvait déclencher des renvois vers **autant d'adresses qu'elle voulait** :
 *    chaque adresse ouvrait son propre compteur. D'où le second limiteur, par adresse cliente.
 * 2. Varier la casse ouvrait un compteur de plus pour la même boîte.
 * 3. Et surtout : `claim.post.ts` appelle ce limiteur **sans** avoir rempli `context.body`. La clé
 *    y valait donc la chaîne littérale `'unknown'`, **un seau partagé par tout le monde** — trois
 *    revendications par quart d'heure pour le site entier, consommées par le premier venu.
 *
 * L'adresse du client est maintenant dans la clé, donc une requête qui n'annonce pas d'adresse
 * visée est quand même comptée par machine, et non dans un seau commun.
 */
const envoiParCoupleRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  /*
   * La dérogation en développement et en E2E, que les cinq autres limiteurs de ce fichier avaient
   * déjà et que celui-ci était seul à ne pas avoir. Sans elle, trois envois par quart d'heure
   * rendent un parcours intestable dès qu'on l'exerce deux fois — et la panne ressemble alors à un
   * défaut du code plutôt qu'à un garde-fou qui a joué.
   */
  max: import.meta.dev || process.env.E2E_TEST === 'true' ? 100 : 3,
  message: "Trop d'envois d'email, veuillez réessayer plus tard",
  keyGenerator: (event: H3Event) =>
    `email:${adresseDuClient(event)}:${adresseViseeParLEnvoi(event)}`,
})

/**
 * Dix envois par quart d'heure et par machine, quelles que soient les adresses visées.
 *
 * C'est le plafond qui manquait : sans lui, compter par couple (client, adresse) laisse une machine
 * arroser autant de boîtes qu'elle veut — chacune avec son compteur neuf. Dix laisse la place à
 * quelqu'un qui se trompe d'adresse, se corrige, et renvoie son code deux ou trois fois.
 */
const envoiParMachineRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: import.meta.dev || process.env.E2E_TEST === 'true' ? 200 : 10,
  message: "Trop d'envois d'email depuis cette connexion, veuillez réessayer plus tard",
  keyGenerator: (event: H3Event) => `email-machine:${adresseDuClient(event)}`,
})

/**
 * Rate limiter pré-configuré pour l'envoi d'emails.
 *
 * Les deux bornes en un seul appel : les points d'API n'ont pas à savoir qu'il y en a deux, et
 * n'avoir à en brancher qu'une est ce qui évite qu'un appelant futur en oublie une.
 */
export const emailRateLimiter = async (event: H3Event) => {
  await envoiParMachineRateLimiter(event)
  await envoiParCoupleRateLimiter(event)
}

/**
 * Rate limiter pré-configuré pour les demandes de reset de mot de passe
 * 3 demandes par 15 minutes par IP (utilisateur non authentifié → clé IP)
 */
export const passwordResetRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: import.meta.dev || process.env.E2E_TEST === 'true' ? 100 : 3,
  message: 'Trop de demandes de réinitialisation, veuillez réessayer plus tard',
})
