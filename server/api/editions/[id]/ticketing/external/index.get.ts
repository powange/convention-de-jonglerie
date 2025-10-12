import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à cette configuration',
    })

  // Récupérer la configuration (sans le clientSecret)
  const config = await prisma.externalTicketing.findUnique({
    where: { editionId },
    include: {
      helloAssoConfig: {
        select: {
          id: true,
          clientId: true,
          organizationSlug: true,
          formType: true,
          formSlug: true,
          createdAt: true,
          updatedAt: true,
          // Ne pas retourner clientSecret
        },
      },
    },
  })

  if (!config) {
    return {
      hasConfig: false,
      config: null,
    }
  }

  return {
    hasConfig: true,
    config,
  }
})
