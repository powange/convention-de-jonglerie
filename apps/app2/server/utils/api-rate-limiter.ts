import { createRateLimiter } from './rate-limiter'

/**
 * Limiteurs des API de recherche, attendus par les layers partagés (contrat d'hôte, mêmes noms
 * qu'app1 — cf. apps/app1/server/utils/api-rate-limiter.ts, qui explique le chiffre).
 *
 * Recherche d'une personne (responsable d'un article du stock…) : soixante par minute et par
 * compte, ce qu'un champ de recherche temporisé produit au plus sous une frappe humaine.
 */
export const personSearchRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Trop de recherches, veuillez réessayer dans une minute',
  keyGenerator: (event) => {
    const user = event.context.user
    return user ? `person-search:${user.id}` : 'person-search:anonymous'
  },
})

// Dépôts de fichiers (photos d'artiste, visuels de spectacle) : même limiteur que les photos de
// profil, déclaré dans rate-limiter.ts.
export { uploadRateLimiter } from './rate-limiter'

/**
 * Aperçu PUBLIC d'un code promo (`GET /api/codes-promo/:code`) : vingt par minute et par adresse,
 * de quoi ouvrir un lien et corriger une faute de frappe, pas de quoi deviner un code au hasard.
 */
export const codePromoRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Trop de codes essayés, veuillez réessayer dans une minute',
  // Par ADRESSE seule : la clé par défaut y ajoute le chemin, qui contient le code — chaque code
  // essayé aurait eu son propre compteur, et la limite n'aurait rien limité.
  keyGenerator: (event) => {
    const ip =
      (event.node.req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      event.node.req.socket.remoteAddress ||
      'inconnue'
    return `code-promo:${ip}`
  },
})

/**
 * Recherche d'adresse du formulaire de l'événement (`GET /api/adresses/recherche`), relayée vers
 * Nominatim, dont la règle d'usage est d'une requête par seconde : trente par minute et par
 * compte suffisent à un champ temporisé, et évitent qu'un compte fasse bannir le serveur.
 */
export const adresseSearchRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Trop de recherches d’adresse, veuillez réessayer dans une minute',
  keyGenerator: (event) => {
    const user = event.context.user
    return user ? `adresse-search:${user.id}` : 'adresse-search:anonymous'
  },
})
