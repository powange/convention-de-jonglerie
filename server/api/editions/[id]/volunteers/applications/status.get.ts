import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

/**
 * Retourne le statut de la candidature bénévole de l'utilisateur connecté pour une édition
 * Route optimisée pour vérifier rapidement si l'utilisateur est un bénévole accepté
 */
export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) {
    throw createError({
      statusCode: 400,
      message: 'Edition invalide',
    })
  }

  // Récupérer uniquement le statut de la candidature
  const application = await prisma.editionVolunteerApplication.findUnique({
    where: {
      editionId_userId: {
        editionId,
        userId: user.id,
      },
    },
    select: {
      status: true,
    },
  })

  // Retourner le statut ou null si pas de candidature
  return {
    status: application?.status || null,
  }
})
