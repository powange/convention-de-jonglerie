import { canManageStock, type EditionWithPermissions } from './permissions/edition-permissions'

import type { UserForPermissions } from './permissions/types'

/**
 * Vérifie si un utilisateur est responsable d'au moins une équipe bénévole
 * sur une édition donnée. Utilisé pour les permissions lecture/réservation
 * du stock matériel.
 */
export async function isAnyTeamLeaderOnEdition(
  userId: number,
  editionId: number
): Promise<boolean> {
  const application = await prisma.editionVolunteerApplication.findFirst({
    where: {
      userId,
      editionId,
      teamAssignments: { some: { isLeader: true } },
    },
    select: { id: true },
  })
  return application !== null
}

/**
 * Vérifie qu'un utilisateur peut **accéder** au stock matériel (lecture +
 * création de réservation).
 *
 * Conditions :
 * - droit `canManageStock` (createur, auteur convention, organisateur avec
 *   le droit, ou admin global)
 * - OU responsable d'au moins une équipe bénévole sur l'édition
 */
export async function canAccessStock(
  edition: EditionWithPermissions,
  user: UserForPermissions
): Promise<boolean> {
  if (canManageStock(edition, user)) return true
  return isAnyTeamLeaderOnEdition(user.id, edition.id)
}

/**
 * Calcule la quantité réservée sur un item sur une période donnée
 * (réservations actives = RESERVED ou PICKED_UP, hors la réservation
 * `excludeReservationId` si fournie pour la mise à jour).
 *
 * Retourne le nombre total d'exemplaires déjà engagés qui chevauchent
 * la période [startsAt, endsAt].
 */
export async function getReservedQuantityOnPeriod(
  stockItemId: number,
  startsAt: Date,
  endsAt: Date,
  excludeReservationId?: number
): Promise<number> {
  const reservations = await prisma.stockReservation.findMany({
    where: {
      stockItemId,
      status: { in: ['RESERVED', 'PICKED_UP'] },
      // chevauchement : (existing.startsAt < endsAt) && (existing.endsAt > startsAt)
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludeReservationId !== undefined && { id: { not: excludeReservationId } }),
    },
    select: { quantityReserved: true },
  })
  return reservations.reduce((sum, r) => sum + r.quantityReserved, 0)
}
