import { requireAuth, type AuthenticatedUser } from '#server/utils/auth-utils'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

/**
 * Vérifie si l'utilisateur est un bénévole accepté pour l'édition
 * @param userId L'ID de l'utilisateur
 * @param editionId L'ID de l'édition
 * @returns true si l'utilisateur est un bénévole accepté
 */
export async function isAcceptedVolunteer(userId: number, editionId: number): Promise<boolean> {
  const application = await prisma.editionVolunteerApplication.findFirst({
    where: {
      userId,
      eventId: editionId,
      status: 'ACCEPTED',
    },
  })

  return !!application
}

/**
 * Vérifie que l'utilisateur peut voir le planning des bénévoles
 * Autorisé pour : les gestionnaires de bénévoles ET les bénévoles acceptés
 * @param event L'événement Nuxt/Nitro
 * @param editionId L'ID de l'édition
 * @returns L'utilisateur authentifié
 * @throws createError si pas autorisé
 */
export async function requireVolunteerPlanningAccess(
  event: any,
  editionId: number
): Promise<AuthenticatedUser> {
  const user = requireAuth(event)

  // Vérifier si l'utilisateur est un bénévole accepté
  const isVolunteer = await isAcceptedVolunteer(user.id, editionId)
  if (isVolunteer) {
    return user
  }

  // Sinon, vérifier les permissions de lecture classiques (organisateurs, etc.)
  try {
    return await useVolunteerPorts().organizers.requireReadAccess(event, editionId)
  } catch {
    throw createError({
      status: 403,
      message: 'Accès non autorisé - vous devez être bénévole accepté ou gestionnaire',
    })
  }
}
