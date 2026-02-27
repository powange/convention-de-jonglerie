import { requireAuth, type AuthenticatedUser } from '../auth-utils'

import { isActiveInTeamSlot, getActiveTeamSlot } from './team-slot-helpers'

const MEAL_VALIDATION_FILTER = { isMealValidationTeam: true } as const

/**
 * Vérifie si un bénévole est actuellement en créneau de validation des repas
 * avec une marge de ±15 minutes (prend en compte les retards)
 */
export async function isActiveMealValidationVolunteer(
  userId: number,
  editionId: number
): Promise<boolean> {
  return isActiveInTeamSlot(userId, editionId, MEAL_VALIDATION_FILTER)
}

/**
 * Vérifie si un utilisateur est leader d'une équipe de validation des repas
 */
export async function isMealValidationTeamLeader(
  userId: number,
  editionId: number
): Promise<boolean> {
  const leaderAssignments = await prisma.applicationTeamAssignment.findMany({
    where: {
      application: {
        userId,
        editionId,
        status: 'ACCEPTED',
      },
      team: MEAL_VALIDATION_FILTER,
      isLeader: true,
    },
  })

  return leaderAssignments.length > 0
}

/**
 * Vérifie si un utilisateur peut accéder à la validation des repas
 * (soit leader, soit bénévole en créneau actif)
 */
export async function canAccessMealValidation(userId: number, editionId: number): Promise<boolean> {
  const isLeader = await isMealValidationTeamLeader(userId, editionId)
  if (isLeader) return true

  return isActiveMealValidationVolunteer(userId, editionId)
}

/**
 * Vérifie que l'utilisateur peut accéder à la validation des repas
 * @throws createError si pas autorisé
 */
export async function requireMealValidationAccess(
  event: any,
  editionId: number
): Promise<AuthenticatedUser> {
  const user = requireAuth(event)

  const hasAccess = await canAccessMealValidation(user.id, editionId)

  if (!hasAccess) {
    throw createError({
      status: 403,
      message:
        "Accès non autorisé - vous devez être leader d'une équipe de validation des repas ou en créneau actif (±15 minutes)",
    })
  }

  return user
}

/**
 * Récupère les informations détaillées du créneau actif de validation des repas d'un bénévole
 * (prend en compte les retards)
 */
export async function getActiveMealValidationSlot(userId: number, editionId: number) {
  return getActiveTeamSlot(userId, editionId, MEAL_VALIDATION_FILTER)
}
