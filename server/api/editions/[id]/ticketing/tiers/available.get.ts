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
      message: 'Droits insuffisants pour accéder à cette fonctionnalité',
    })

  try {
    // Récupérer les tarifs depuis la billeterie externe
    const externalTicketing = await prisma.externalTicketing.findFirst({
      where: { editionId },
      select: {
        id: true,
        tiers: {
          select: {
            id: true,
            name: true,
            price: true,
            description: true,
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
    })

    if (!externalTicketing) {
      return { tiers: [] }
    }

    return {
      tiers: externalTicketing.tiers,
    }
  } catch (error: any) {
    console.error('Erreur lors de la récupération des tarifs:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des tarifs',
    })
  }
})
