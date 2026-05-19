import { z } from 'zod'

import { canManageStock, type EditionWithPermissions } from './permissions/edition-permissions'

import type { UserForPermissions } from './permissions/types'

/**
 * Schéma Zod d'un sous-emplacement de stock envoyé par le client lors d'une
 * création ou d'une mise à jour d'item. La validation cross-champ (au moins
 * une localisation parmi texte/zone/marqueur) est faite via `.refine()`.
 */
export const stockItemLocationInputSchema = z
  .object({
    location: z.string().trim().max(200).nullable().optional(),
    zoneId: z.number().int().positive().nullable().optional(),
    markerId: z.number().int().positive().nullable().optional(),
    quantity: z.number().int().positive(),
  })
  .refine((data) => !!(data.location?.trim() || data.zoneId || data.markerId), {
    message: 'Indiquez une localisation textuelle ou un emplacement sur la carte',
    path: ['location'],
  })
  .refine((data) => !(data.zoneId && data.markerId), {
    message: 'Un emplacement ne peut pas être à la fois une zone et un marqueur',
    path: ['zoneId'],
  })

export type StockItemLocationInput = z.infer<typeof stockItemLocationInputSchema>

/**
 * Vérifie que chaque sous-emplacement référence une zone/marqueur appartenant
 * à l'édition, et que la somme des quantités ne dépasse pas la quantité totale
 * de l'item. Lève une createError sinon.
 */
export async function validateStockItemLocations(
  locations: StockItemLocationInput[],
  editionId: number,
  itemQuantity: number
): Promise<void> {
  if (locations.length === 0) return

  const totalLocated = locations.reduce((sum, l) => sum + l.quantity, 0)
  if (totalLocated > itemQuantity) {
    throw createError({
      status: 400,
      message: 'La somme des quantités par emplacement dépasse la quantité totale de l’objet',
    })
  }

  const zoneIds = Array.from(
    new Set(locations.map((l) => l.zoneId).filter((id): id is number => !!id))
  )
  const markerIds = Array.from(
    new Set(locations.map((l) => l.markerId).filter((id): id is number => !!id))
  )

  if (zoneIds.length > 0) {
    const zones = await prisma.editionZone.findMany({
      where: { id: { in: zoneIds }, editionId },
      select: { id: true },
    })
    if (zones.length !== zoneIds.length) {
      throw createError({
        status: 400,
        message: "Une zone référencée n'appartient pas à cette édition",
      })
    }
  }
  if (markerIds.length > 0) {
    const markers = await prisma.editionMarker.findMany({
      where: { id: { in: markerIds }, editionId },
      select: { id: true },
    })
    if (markers.length !== markerIds.length) {
      throw createError({
        status: 400,
        message: "Un marqueur référencé n'appartient pas à cette édition",
      })
    }
  }
}

/**
 * Vérifie qu'une zone/un marqueur référencés par une réservation appartiennent
 * bien à l'édition. Lève une createError sinon.
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
 * Include Prisma standard pour récupérer les sous-emplacements d'un item de
 * stock avec les infos zone/marker nécessaires pour l'affichage.
 */
export const stockItemLocationsInclude = {
  orderBy: [{ displayOrder: 'asc' as const }, { createdAt: 'asc' as const }],
  include: {
    zone: { select: { id: true, name: true, color: true } },
    marker: { select: { id: true, name: true } },
  },
}

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
