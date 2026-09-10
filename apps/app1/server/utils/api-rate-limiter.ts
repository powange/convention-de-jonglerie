import { createRateLimiter } from './rate-limiter'

/**
 * Rate limiter pour les uploads d'images
 * 10 uploads par heure par utilisateur
 */
export const uploadRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10,
  message: "Trop d'uploads, veuillez réessayer plus tard",
  keyGenerator: (event) => {
    const user = event.context.user
    return user ? `upload:${user.id}` : 'upload:anonymous'
  },
})

/**
 * Rate limiter pour la création de contenu (conventions, éditions, posts)
 * 20 créations par heure par utilisateur
 */
export const contentCreationRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 20,
  message: 'Trop de créations de contenu, veuillez réessayer plus tard',
  keyGenerator: (event) => {
    const user = event.context.user
    return user ? `content:${user.id}` : 'content:anonymous'
  },
})

/**
 * Rate limiter pour les commentaires
 * 30 commentaires par heure par utilisateur
 */
export const commentRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 30,
  message: 'Trop de commentaires, veuillez ralentir',
  keyGenerator: (event) => {
    const user = event.context.user
    return user ? `comment:${user.id}` : 'comment:anonymous'
  },
})

/**
 * Rate limiter pour le checkout Stripe (donations)
 * 10 tentatives par heure par IP
 */
export const checkoutRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 10,
  message: 'Trop de tentatives de paiement, veuillez réessayer plus tard',
  keyGenerator: (event) => {
    const ip =
      (String(event.node.req.headers['x-forwarded-for'] || '').split(',')[0] ?? '').trim() ||
      event.node.req.socket.remoteAddress ||
      'unknown'
    return `checkout:${ip}`
  },
})

/**
 * Rate limiter pour les API de recherche
 * 60 requêtes par minute par IP
 */
export const searchRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'Trop de recherches, veuillez réessayer dans une minute',
  keyGenerator: (event) => {
    const ip =
      (String(event.node.req.headers['x-forwarded-for'] || '').split(',')[0] ?? '').trim() ||
      event.node.req.socket.remoteAddress ||
      'unknown'
    return `search:${ip}`
  },
})

/**
 * Rate limiter pour les recherches de personnes
 * 60 requêtes par minute par utilisateur
 *
 * Ces points d'API rendent des gens : on les protège d'un balayage méthodique — « aa », « ab »,
 * « ac »… — qui reconstituerait un annuaire à petites doses.
 *
 * La clé est l'utilisateur et non l'IP, contrairement à `searchRateLimiter` : ces recherches
 * exigent une session, la menace est donc un compte, pas une adresse. Compter par IP punirait au
 * passage les organisateurs qui partagent le wifi d'un même lieu.
 *
 * Soixante par minute, calé sur deux repères : c'est le débit que le projet a déjà retenu pour la
 * recherche, et c'est six à dix fois ce qu'une frappe humaine produit — le champ n'émet qu'après
 * 300 ms de pause, et chercher une personne coûte trois à cinq requêtes.
 */
export const personSearchRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60,
  message: 'Trop de recherches, veuillez réessayer dans une minute',
  keyGenerator: (event) => {
    const user = event.context.user
    return user ? `person-search:${user.id}` : 'person-search:anonymous'
  },
})
