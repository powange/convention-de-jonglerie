import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = parseInt(getRouterParam(event, 'id') || '0')

  if (!editionId) {
    throw createError({ statusCode: 400, message: 'Edition invalide' })
  }

  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à ces données',
    })
  }

  try {
    const shows = await prisma.show.findMany({
      where: { editionId },
      include: {
        artists: {
          include: {
            artist: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    prenom: true,
                    nom: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        startDateTime: 'asc',
      },
    })

    return {
      success: true,
      shows,
    }
  } catch (error: unknown) {
    console.error('Erreur lors de la récupération des spectacles:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des spectacles',
    })
  }
})
