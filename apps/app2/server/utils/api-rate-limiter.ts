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
