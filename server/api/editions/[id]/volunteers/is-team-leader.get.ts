import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

/**
 * Vérifie si l'utilisateur connecté est responsable d'au moins une équipe de bénévoles pour cette édition
 * Renvoie true si l'utilisateur est leader d'au moins une équipe, false sinon
 */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')

  if (!editionId) {
    throw createError({
      statusCode: 400,
      message: "ID d'édition invalide",
    })
  }

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
})
