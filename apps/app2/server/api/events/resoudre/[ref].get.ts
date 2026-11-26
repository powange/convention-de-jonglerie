import { resoudreEvenement } from '../../../utils/evenement-public'

import { optionalAuth } from '#server/utils/auth-utils'

/**
 * `{ id, publicId }` d'un événement désigné par son numéro ou son identifiant public — ce dont
 * l'interface a besoin pour passer d'une adresse (`/events/<publicId>/…`) à l'id que manipulent les
 * pages du layer bénévoles, et pour réécrire une ancienne adresse numérique.
 *
 * Accessible sans session (une page bénévoles publique se partage par lien), mais selon la règle de
 * `resoudreEvenement` : par numéro, seulement pour qui est impliqué. Sinon 404.
 */
export default defineEventHandler(async (event) => {
  const ref = String(getRouterParam(event, 'ref') ?? '')
  const user = optionalAuth(event)
  const trouve = ref ? await resoudreEvenement(ref, user?.id ?? null) : null
  if (!trouve) throw createError({ status: 404, message: 'Événement introuvable' })
  return { id: trouve.id, publicId: trouve.publicId }
})
