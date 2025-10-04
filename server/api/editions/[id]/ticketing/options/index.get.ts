import { canAccessEditionData } from '../../../../../utils/edition-permissions'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à ces données',
    })

  try {
    // Récupérer les options HelloAsso (uniquement si une config existe)
    const config = await prisma.externalTicketing.findUnique({
      where: { editionId },
      include: {
        helloAssoOptions: {
          orderBy: { position: 'asc' },
        },
      },
    })

    return config?.helloAssoOptions || []
  } catch (error: any) {
    console.error('Failed to fetch options from DB:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des options',
    })
  }
})
