import { droitsSurEvenement } from './droits-evenement'

import type { H3Event } from 'h3'

/**
 * Qui gère les bénévoles d'un événement Flowvent : son PROPRIÉTAIRE, un administrateur global, et
 * les organisateurs à qui ce droit a été donné (`EditionOrganizer.canManageVolunteers`). Contrat
 * d'hôte du layer bénévoles — app1 y applique ses propres règles (conventions, droits par édition).
 * La règle vit dans `droits-evenement.ts`, écrite une fois.
 */
export async function canManageEditionVolunteers(
  eventId: number,
  userId: number,
  _event?: H3Event
): Promise<boolean> {
  return (await droitsSurEvenement(eventId, userId)).benevoles
}

/** Les comptes à prévenir quand une décision de gestion est attendue (échanges de créneaux…). */
export async function listerGestionnairesBenevoles(eventId: number): Promise<number[]> {
  const [evenement, organisateurs] = await Promise.all([
    prisma.event.findUnique({ where: { id: eventId }, select: { ownerId: true } }),
    prisma.editionOrganizer.findMany({
      // Seulement ceux qui ont le droit de décider : prévenir les autres leur demanderait une action
      // qu'ils ne peuvent pas faire.
      where: { editionId: eventId, canManageVolunteers: true },
      select: { organizer: { select: { userId: true } } },
    }),
  ])
  if (!evenement) return []
  return [...new Set([evenement.ownerId, ...organisateurs.map((o) => o.organizer.userId)])]
}
