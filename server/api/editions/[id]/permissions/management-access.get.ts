import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { isActiveAccessControlVolunteer } from '#server/utils/permissions/access-control-permissions'
import { canAccessMealValidation } from '#server/utils/permissions/meal-validation-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Endpoint unifié pour vérifier les accès « bénévole » à la gestion d'une édition.
 *
 * Regroupe en un seul appel les trois vérifications qui nécessitaient auparavant
 * trois requêtes distinctes (is-team-leader, can-access-meal-validation,
 * access-control/status). Utilisé par EditionManageButton en repli, lorsque
 * l'accès n'est pas déjà acquis via les critères synchrones (créateur, admin,
 * droits d'édition, organisateur).
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const [teamLeaderAssignment, mealValidation, accessControlActive] = await Promise.all([
      // Responsable d'au moins une équipe de bénévoles (cf. is-team-leader.get.ts)
      prisma.applicationTeamAssignment
        .findFirst({
          where: {
            isLeader: true,
            application: {
              userId: user.id,
              editionId,
              status: 'ACCEPTED',
            },
          },
        })
        .then((assignment) => !!assignment)
        .catch(() => false),
      // Accès à la validation des repas (leader d'équipe repas ou créneau actif)
      canAccessMealValidation(user.id, editionId).catch(() => false),
      // Créneau actif de contrôle d'accès
      isActiveAccessControlVolunteer(user.id, editionId).catch(() => false),
    ])

    return createSuccessResponse({
      isTeamLeader: teamLeaderAssignment,
      canAccessMealValidation: mealValidation,
      isAccessControlActive: accessControlActive,
    })
  },
  { operationName: 'GetEditionManagementAccess' }
)
