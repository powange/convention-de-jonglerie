import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { validateEditionId } from '@@/server/utils/validation-helpers'

/**
 * Vérifie si l'utilisateur connecté est responsable d'au moins une équipe de bénévoles pour cette édition
 * Renvoie true si l'utilisateur est leader d'au moins une équipe, false sinon
 */
export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  // Vérifier s'il existe au moins une assignation d'équipe où l'utilisateur est leader
  const leaderAssignment = await prisma.applicationTeamAssignment.findFirst({
    where: {
      isLeader: true,
      application: {
        userId: user.id,
        editionId,
        status: 'ACCEPTED',
      },
    },
  })

  return {
    isTeamLeader: !!leaderAssignment,
  }
}, 'IsVolunteerTeamLeader')
