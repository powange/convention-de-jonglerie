import { adresseApplication } from '../../../../utils/application-evenement'
import { droitsSurEvenement } from '../../../../utils/droits-evenement'
import { resoudreEvenement } from '../../../../utils/evenement-public'

import { optionalAuth } from '#server/utils/auth-utils'

/**
 * Où l'application d'un événement s'ouvre, selon qui l'ouvre (`/events/<publicId>/app`) :
 * - un organisateur : la gestion ;
 * - un artiste de l'événement : son espace artiste ;
 * - un bénévole (candidature, acceptée ou non) : son espace bénévole ;
 * - les autres : la page publique de l'événement ;
 * - sans connexion, pour un événement qui n'est pas public : la connexion, qui y ramène.
 *
 * Un compte connecté qui n'a pas accès à un événement non public : 404, comme la page publique.
 */
export default defineEventHandler(async (event) => {
  const user = optionalAuth(event)
  const ref = String(getRouterParam(event, 'id') ?? '')
  const resolu = await resoudreEvenement(ref, user?.id ?? null)
  if (!resolu) {
    if (!user) {
      return { destination: `/login?returnTo=${encodeURIComponent(adresseApplication(ref))}` }
    }
    throw createError({ status: 404, message: 'Événement introuvable' })
  }
  const base = `/events/${resolu.publicId}`
  if (!user) return { destination: base }

  const droits = await droitsSurEvenement(resolu.id, user.id)
  if (droits.voir) return { destination: `${base}/gestion` }

  const e = await prisma.event.findUniqueOrThrow({
    where: { id: resolu.id },
    select: { artistsEnabled: true, volunteersEnabled: true },
  })
  if (
    e.artistsEnabled &&
    (await prisma.editionArtist.findFirst({
      where: { editionId: resolu.id, userId: user.id },
      select: { id: true },
    }))
  ) {
    return { destination: `${base}/artist-space` }
  }
  if (
    e.volunteersEnabled &&
    (await prisma.editionVolunteerApplication.findFirst({
      where: { eventId: resolu.id, userId: user.id },
      select: { id: true },
    }))
  ) {
    return { destination: `${base}/volunteers` }
  }
  return { destination: base }
})
