import { requireAuth } from '../../../../../utils/auth-utils'
import { canAccessEditionData } from '../../../../../utils/permissions/edition-permissions'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à ces données',
    })

  try {
    const quotas = await prisma.ticketingQuota.findMany({
      where: { editionId },
      orderBy: { createdAt: 'asc' },
    })

    return quotas
  } catch (error: any) {
    console.error('Failed to fetch quotas:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des quotas',
    })
  }
})
