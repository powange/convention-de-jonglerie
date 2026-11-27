import { requireUserSession } from '#imports'

import { adresseSearchRateLimiter } from '../../utils/api-rate-limiter'
import { rechercherAdresses } from '../../utils/geocodage'

/**
 * Propositions d'adresses pour le champ de recherche du formulaire de l'événement : chacune remplit
 * l'adresse, la ville, le pays ET les coordonnées.
 *
 * Relayée par le serveur plutôt qu'appelée depuis le navigateur : Nominatim exige que l'application
 * s'identifie (un navigateur ne peut pas fixer le User-Agent), et le débit se limite ici par compte.
 */
export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  await adresseSearchRateLimiter(event)
  const q = String(getQuery(event).q ?? '').slice(0, 200)
  return { adresses: await rechercherAdresses(q) }
})
