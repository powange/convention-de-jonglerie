import { canManageStock, type EditionWithPermissions } from './permissions/edition-permissions'

import type { UserForPermissions } from './permissions/types'

/**
 * Vérifie qu'une zone/un marqueur référencés par une réservation ou un item
 * de stock appartiennent bien à l'édition. Lève une createError sinon.
 */
export async function validateReservationLocation(
  loc: { zoneId: number | null; markerId: number | null },
  editionId: number
): Promise<void> {
  if (loc.zoneId) {
    const zone = await prisma.editionZone.findFirst({
      where: { id: loc.zoneId, editionId },
      select: { id: true },
    })
    if (!zone) {
      throw createError({
        status: 400,
        message: "La zone référencée n'appartient pas à cette édition",
      })
    }
  }
  if (loc.markerId) {
    const marker = await prisma.editionMarker.findFirst({
      where: { id: loc.markerId, editionId },
      select: { id: true },
    })
    if (!marker) {
      throw createError({
        status: 400,
        message: "Le marqueur référencé n'appartient pas à cette édition",
      })
    }
  }
}

/**
 * Include Prisma standard pour récupérer l'emplacement de rangement d'un item
 * de stock avec les infos zone/marker nécessaires pour l'affichage.
 */
export const stockItemLocationInclude = {
  zone: { select: { id: true, name: true, color: true } },
  marker: { select: { id: true, name: true } },
} as const

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
 *
 * Le paramètre `client` permet d'utiliser un client de transaction Prisma
 * (`tx` dans `prisma.$transaction(async (tx) => …)`) pour serrer la fenêtre
 * de race condition entre la vérification de dispo et la création.
 */
export async function getReservedQuantityOnPeriod(
  stockItemId: number,
  startsAt: Date,
  endsAt: Date,
  excludeReservationId?: number,
  client: { stockReservation: typeof prisma.stockReservation } = prisma
): Promise<number> {
  const reservations = await client.stockReservation.findMany({
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
