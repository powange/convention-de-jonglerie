import { requireAuth, type AuthenticatedUser } from '../auth-utils'

import { isActiveInTeamSlot, getActiveTeamSlot } from './team-slot-helpers'

const ACCESS_CONTROL_FILTER = { isAccessControlTeam: true } as const

/**
 * Vérifie si un bénévole est actuellement en créneau de contrôle d'accès
 * avec une marge de ±15 minutes (prend en compte les retards)
 */
export async function isActiveAccessControlVolunteer(
  userId: number,
  editionId: number
): Promise<boolean> {
  return isActiveInTeamSlot(userId, editionId, ACCESS_CONTROL_FILTER)
}

/**
 * Vérifie que l'utilisateur est un bénévole en créneau actif de contrôle d'accès
 * @throws createError si pas autorisé
 */
export async function requireActiveAccessControlVolunteer(
  event: any,
  editionId: number
): Promise<AuthenticatedUser> {
  const user = requireAuth(event)

  const isActive = await isActiveAccessControlVolunteer(user.id, editionId)

  if (!isActive) {
    throw createError({
      status: 403,
      message:
        "Accès non autorisé - vous devez être en créneau actif de contrôle d'accès (±15 minutes)",
    })
  }

  return user
}

/**
 * Récupère les informations détaillées du créneau actif de contrôle d'accès d'un bénévole
 * (prend en compte les retards)
 */
export async function getActiveAccessControlSlot(userId: number, editionId: number) {
  return getActiveTeamSlot(userId, editionId, ACCESS_CONTROL_FILTER)
}
