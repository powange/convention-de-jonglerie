import { requireAuth, type AuthenticatedUser } from '../auth-utils'

/**
 * Vérifie si un bénévole est actuellement en créneau de contrôle d'accès
 * avec une marge de ±15 minutes (prend en compte les retards)
 * @param userId L'ID de l'utilisateur
 * @param editionId L'ID de l'édition
 * @returns true si l'utilisateur est en créneau actif de contrôle d'accès
 */
export async function isActiveAccessControlVolunteer(
  userId: number,
  editionId: number
): Promise<boolean> {
  const now = new Date()

  // Récupérer toutes les assignations du bénévole dans des équipes de contrôle d'accès
  // On ne filtre pas par date ici car on doit prendre en compte le delayMinutes
  const assignments = await prisma.volunteerAssignment.findMany({
    where: {
      userId,
      timeSlot: {
        editionId,
        team: {
          isAccessControlTeam: true,
        },
      },
    },
    include: {
      timeSlot: {
        select: {
          id: true,
          startDateTime: true,
          endDateTime: true,
          delayMinutes: true,
          team: true,
        },
      },
    },
  })

  // Filtrer manuellement en tenant compte du delayMinutes
  const activeAssignments = assignments.filter((assignment) => {
    const delay = assignment.timeSlot.delayMinutes || 0
    const adjustedStart = new Date(assignment.timeSlot.startDateTime.getTime() + delay * 60 * 1000)
    const adjustedEnd = new Date(assignment.timeSlot.endDateTime.getTime() + delay * 60 * 1000)

    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000)
    const fifteenMinutesLater = new Date(now.getTime() + 15 * 60 * 1000)

    // Le créneau est actif si :
    // - Il commence avant ou pendant (now + 15min)
    // - Il finit après ou pendant (now - 15min)
    return adjustedStart <= fifteenMinutesLater && adjustedEnd >= fifteenMinutesAgo
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
 * (prend en compte les retards)
 * @param userId L'ID de l'utilisateur
 * @param editionId L'ID de l'édition
 * @returns Les informations du créneau actif ou null
 */
export async function getActiveAccessControlSlot(userId: number, editionId: number) {
  const now = new Date()

  // Récupérer toutes les assignations du bénévole dans des équipes de contrôle d'accès
  const assignments = await prisma.volunteerAssignment.findMany({
    where: {
      userId,
      timeSlot: {
        editionId,
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

  // Filtrer manuellement en tenant compte du delayMinutes
  const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000)
  const fifteenMinutesLater = new Date(now.getTime() + 15 * 60 * 1000)

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
