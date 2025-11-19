import { requireAuth, type AuthenticatedUser } from '../auth-utils'

/**
 * Vérifie si un bénévole est actuellement en créneau de validation des repas
 * avec une marge de ±15 minutes (prend en compte les retards)
 * @param userId L'ID de l'utilisateur
 * @param editionId L'ID de l'édition
 * @returns true si l'utilisateur est en créneau actif de validation des repas
 */
export async function isActiveMealValidationVolunteer(
  userId: number,
  editionId: number
): Promise<boolean> {
  const now = new Date()

  // Récupérer toutes les assignations du bénévole dans des équipes de validation des repas
  // On ne filtre pas par date ici car on doit prendre en compte le delayMinutes
  const assignments = await prisma.volunteerAssignment.findMany({
    where: {
      userId,
      timeSlot: {
        editionId,
        team: {
          isMealValidationTeam: true,
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
 * (prend en compte les retards)
 * @param userId L'ID de l'utilisateur
 * @param editionId L'ID de l'édition
 * @returns Les informations du créneau actif ou null
 */
export async function getActiveMealValidationSlot(userId: number, editionId: number) {
  const now = new Date()

  // Récupérer toutes les assignations du bénévole dans des équipes de validation des repas
  const assignments = await prisma.volunteerAssignment.findMany({
    where: {
      userId,
      timeSlot: {
        editionId,
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
