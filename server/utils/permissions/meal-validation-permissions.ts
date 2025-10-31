import { requireAuth, type AuthenticatedUser } from '../auth-utils'
import { prisma } from '../prisma'

/**
 * Vérifie si un bénévole est actuellement en créneau de validation des repas
 * avec une marge de ±15 minutes
 * @param userId L'ID de l'utilisateur
 * @param editionId L'ID de l'édition
 * @returns true si l'utilisateur est en créneau actif de validation des repas
 */
export async function isActiveMealValidationVolunteer(
  userId: number,
  editionId: number
): Promise<boolean> {
  const now = new Date()
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000)
  const fifteenMinutesLater = new Date(now.getTime() + 15 * 60 * 1000)

  // Récupérer les assignations du bénévole pour des créneaux actifs
  // dans des équipes de validation des repas
  const activeAssignments = await prisma.volunteerAssignment.findMany({
    where: {
      userId,
      timeSlot: {
        editionId,
        // Le créneau doit commencer avant ou pendant la période actuelle + 15min
        startDateTime: {
          lte: fifteenMinutesLater,
        },
        // Le créneau doit finir après ou pendant la période actuelle - 15min
        endDateTime: {
          gte: fifteenMinutesAgo,
        },
        team: {
          isMealValidationTeam: true,
        },
      },
    },
    include: {
      timeSlot: {
        include: {
          team: true,
        },
      },
    },
  })

  return activeAssignments.length > 0
}

/**
 * Vérifie si un utilisateur est leader d'une équipe de validation des repas
 * @param userId L'ID de l'utilisateur
 * @param editionId L'ID de l'édition
 * @returns true si l'utilisateur est leader d'une équipe de validation des repas
 */
export async function isMealValidationTeamLeader(
  userId: number,
  editionId: number
): Promise<boolean> {
  // Récupérer toutes les équipes de validation des repas dont l'utilisateur est leader
  const leaderAssignments = await prisma.applicationTeamAssignment.findMany({
    where: {
      application: {
        userId,
        editionId,
        status: 'ACCEPTED',
      },
      team: {
        isMealValidationTeam: true,
      },
      isLeader: true,
    },
  })

  return leaderAssignments.length > 0
}

/**
 * Vérifie si un utilisateur peut accéder à la validation des repas
 * (soit leader, soit bénévole en créneau actif)
 * @param userId L'ID de l'utilisateur
 * @param editionId L'ID de l'édition
 * @returns true si l'utilisateur peut accéder à la validation des repas
 */
export async function canAccessMealValidation(userId: number, editionId: number): Promise<boolean> {
  // Vérifier si l'utilisateur est leader d'une équipe de validation des repas
  const isLeader = await isMealValidationTeamLeader(userId, editionId)
  if (isLeader) return true

  // Sinon, vérifier si l'utilisateur est en créneau actif
  const isActive = await isActiveMealValidationVolunteer(userId, editionId)
  return isActive
}

/**
 * Vérifie que l'utilisateur peut accéder à la validation des repas
 * @param event L'événement Nuxt/Nitro
 * @param editionId L'ID de l'édition
 * @returns L'utilisateur authentifié
 * @throws createError si pas autorisé
 */
export async function requireMealValidationAccess(
  event: any,
  editionId: number
): Promise<AuthenticatedUser> {
  const user = requireAuth(event)

  // Vérifier si l'utilisateur peut accéder à la validation des repas
  const hasAccess = await canAccessMealValidation(user.id, editionId)

  if (!hasAccess) {
    throw createError({
      statusCode: 403,
      message:
        "Accès non autorisé - vous devez être leader d'une équipe de validation des repas ou en créneau actif (±15 minutes)",
    })
  }

  return user
}

/**
 * Récupère les informations détaillées du créneau actif de validation des repas d'un bénévole
 * @param userId L'ID de l'utilisateur
 * @param editionId L'ID de l'édition
 * @returns Les informations du créneau actif ou null
 */
export async function getActiveMealValidationSlot(userId: number, editionId: number) {
  const now = new Date()
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000)
  const fifteenMinutesLater = new Date(now.getTime() + 15 * 60 * 1000)

  const assignment = await prisma.volunteerAssignment.findFirst({
    where: {
      userId,
      timeSlot: {
        editionId,
        startDateTime: {
          lte: fifteenMinutesLater,
        },
        endDateTime: {
          gte: fifteenMinutesAgo,
        },
        team: {
          isMealValidationTeam: true,
        },
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

  if (!assignment) {
    return null
  }

  return {
    slotId: assignment.timeSlot.id,
    teamId: assignment.timeSlot.teamId,
    teamName: assignment.timeSlot.team?.name,
    startDateTime: assignment.timeSlot.startDateTime,
    endDateTime: assignment.timeSlot.endDateTime,
    title: assignment.timeSlot.title,
  }
}
