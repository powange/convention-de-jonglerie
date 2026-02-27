import type { Prisma } from '@prisma/client'

/**
 * Marge de tolérance (±15 minutes) pour les créneaux actifs
 */
const SLOT_TOLERANCE_MS = 15 * 60 * 1000

/**
 * Type pour le filtre d'équipe Prisma (ex: { isAccessControlTeam: true })
 */
type TeamFilter = Prisma.VolunteerTeamWhereInput

/**
 * Vérifie si un bénévole est actuellement en créneau actif pour une catégorie d'équipe
 * avec une marge de ±15 minutes (prend en compte les retards)
 *
 * @param userId L'ID de l'utilisateur
 * @param editionId L'ID de l'édition
 * @param teamFilter Le filtre Prisma pour la catégorie d'équipe
 * @returns true si l'utilisateur est en créneau actif
 */
export async function isActiveInTeamSlot(
  userId: number,
  editionId: number,
  teamFilter: TeamFilter
): Promise<boolean> {
  const now = new Date()

  const assignments = await prisma.volunteerAssignment.findMany({
    where: {
      userId,
      timeSlot: {
        editionId,
        team: teamFilter,
      },
    },
    include: {
      timeSlot: {
        select: {
          startDateTime: true,
          endDateTime: true,
          delayMinutes: true,
        },
      },
    },
  })

  return assignments.some((assignment) => {
    const delay = assignment.timeSlot.delayMinutes || 0
    const adjustedStart = new Date(assignment.timeSlot.startDateTime.getTime() + delay * 60 * 1000)
    const adjustedEnd = new Date(assignment.timeSlot.endDateTime.getTime() + delay * 60 * 1000)

    return (
      adjustedStart <= new Date(now.getTime() + SLOT_TOLERANCE_MS) &&
      adjustedEnd >= new Date(now.getTime() - SLOT_TOLERANCE_MS)
    )
  })
}

/**
 * Récupère les informations détaillées du créneau actif d'un bénévole
 * pour une catégorie d'équipe (prend en compte les retards)
 *
 * @param userId L'ID de l'utilisateur
 * @param editionId L'ID de l'édition
 * @param teamFilter Le filtre Prisma pour la catégorie d'équipe
 * @returns Les informations du créneau actif ou null
 */
export async function getActiveTeamSlot(userId: number, editionId: number, teamFilter: TeamFilter) {
  const now = new Date()

  const assignments = await prisma.volunteerAssignment.findMany({
    where: {
      userId,
      timeSlot: {
        editionId,
        team: teamFilter,
      },
    },
    include: {
      timeSlot: {
        include: {
          team: true,
        },
      },
    },
    orderBy: {
      timeSlot: {
        startDateTime: 'asc',
      },
    },
  })

  const fifteenMinutesAgo = new Date(now.getTime() - SLOT_TOLERANCE_MS)
  const fifteenMinutesLater = new Date(now.getTime() + SLOT_TOLERANCE_MS)

  const activeAssignment = assignments.find((assignment) => {
    const delay = assignment.timeSlot.delayMinutes || 0
    const adjustedStart = new Date(assignment.timeSlot.startDateTime.getTime() + delay * 60 * 1000)
    const adjustedEnd = new Date(assignment.timeSlot.endDateTime.getTime() + delay * 60 * 1000)

    return adjustedStart <= fifteenMinutesLater && adjustedEnd >= fifteenMinutesAgo
  })

  if (!activeAssignment) {
    return null
  }

  return {
    slotId: activeAssignment.timeSlot.id,
    teamId: activeAssignment.timeSlot.teamId,
    teamName: activeAssignment.timeSlot.team?.name,
    startDateTime: activeAssignment.timeSlot.startDateTime,
    endDateTime: activeAssignment.timeSlot.endDateTime,
    delayMinutes: activeAssignment.timeSlot.delayMinutes,
    title: activeAssignment.timeSlot.title,
  }
}
