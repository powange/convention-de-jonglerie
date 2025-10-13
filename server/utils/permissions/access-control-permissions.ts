import { requireAuth, type AuthenticatedUser } from '../auth-utils'
import { prisma } from '../prisma'

/**
 * Vérifie si un bénévole est actuellement en créneau de contrôle d'accès
 * avec une marge de ±15 minutes
 * @param userId L'ID de l'utilisateur
 * @param editionId L'ID de l'édition
 * @returns true si l'utilisateur est en créneau actif de contrôle d'accès
 */
export async function isActiveAccessControlVolunteer(
  userId: number,
  editionId: number
): Promise<boolean> {
  const now = new Date()
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000)
  const fifteenMinutesLater = new Date(now.getTime() + 15 * 60 * 1000)

  // Récupérer les assignations du bénévole pour des créneaux actifs
  // dans des équipes de contrôle d'accès
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
          isAccessControlTeam: true,
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
 * Vérifie que l'utilisateur est un bénévole en créneau actif de contrôle d'accès
 * @param event L'événement Nuxt/Nitro
 * @param editionId L'ID de l'édition
 * @returns L'utilisateur authentifié
 * @throws createError si pas autorisé
 */
export async function requireActiveAccessControlVolunteer(
  event: any,
  editionId: number
): Promise<AuthenticatedUser> {
  const user = requireAuth(event)

  // Vérifier si l'utilisateur est actuellement en créneau de contrôle d'accès
  const isActive = await isActiveAccessControlVolunteer(user.id, editionId)

  if (!isActive) {
    throw createError({
      statusCode: 403,
      message:
        "Accès non autorisé - vous devez être en créneau actif de contrôle d'accès (±15 minutes)",
    })
  }

  return user
}

/**
 * Récupère les informations détaillées du créneau actif de contrôle d'accès d'un bénévole
 * @param userId L'ID de l'utilisateur
 * @param editionId L'ID de l'édition
 * @returns Les informations du créneau actif ou null
 */
export async function getActiveAccessControlSlot(userId: number, editionId: number) {
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
          isAccessControlTeam: true,
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
