import type { H3Event } from 'h3'

/**
 * Qui gère les bénévoles d'un événement Flowvent : son PROPRIÉTAIRE, ses organisateurs déclarés
 * (`EditionOrganizer`) et un administrateur global. Contrat d'hôte du layer bénévoles — app1 y
 * applique ses propres règles (conventions, droits par édition).
 */
export async function canManageEditionVolunteers(
  eventId: number,
  userId: number,
  _event?: H3Event
): Promise<boolean> {
  const [evenement, utilisateur, organisateur] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { isGlobalAdmin: true } }),
    prisma.editionOrganizer.findFirst({
      where: { editionId: eventId, organizer: { userId } },
      select: { id: true },
    }),
  ])
  if (!evenement) return false
  return evenement.ownerId === userId || !!utilisateur?.isGlobalAdmin || !!organisateur
}

/** Les comptes à prévenir quand une décision de gestion est attendue (échanges de créneaux…). */
export async function listerGestionnairesBenevoles(eventId: number): Promise<number[]> {
  const [evenement, organisateurs] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } }),
    prisma.editionOrganizer.findMany({
      where: { editionId: eventId },
      select: { organizer: { select: { userId: true } } },
    }),
  ])
  if (!evenement) return []
  return [...new Set([evenement.ownerId, ...organisateurs.map((o) => o.organizer.userId)])]
}
