import { isHttpError } from '@@/server/types/prisma-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { getEmailHash } from '@@/server/utils/email-hash'
import { hasEditionEditPermission } from '@@/server/utils/permissions/permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const editionId = parseInt(getRouterParam(event, 'id') as string)
    const itemId = parseInt(getRouterParam(event, 'itemId') as string)

    if (!editionId || isNaN(editionId) || !itemId || isNaN(itemId)) {
      throw createError({
        statusCode: 400,
        message: 'ID invalide',
      })
    }

    const user = requireAuth(event)
    const userId = user.id

    // Vérifier que l'objet trouvé existe et appartient à l'édition
    const lostFoundItem = await prisma.lostFoundItem.findFirst({
      where: {
        id: itemId,
        editionId: editionId,
      },
    })

    if (!lostFoundItem) {
      throw createError({
        statusCode: 404,
        message: 'Objet trouvé non trouvé',
      })
    }

    // Vérifier que l'utilisateur est un collaborateur
    const hasPermission = await hasEditionEditPermission(userId, editionId)
    if (!hasPermission) {
      throw createError({
        statusCode: 403,
        message: "Vous devez être collaborateur pour modifier le statut d'un objet trouvé",
      })
    }

    // Mettre à jour le statut
    const rawItem = await prisma.lostFoundItem.update({
      where: { id: itemId },
      data: {
        status: lostFoundItem.status === 'RETURNED' ? 'LOST' : 'RETURNED',
        updatedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
            profilePicture: true,
            updatedAt: true,
            email: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                prenom: true,
                nom: true,
                profilePicture: true,
                updatedAt: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    const { email, ...userWithoutEmail } = rawItem.user
    const itemUser = {
      ...userWithoutEmail,
      emailHash: getEmailHash(email),
    }

    const comments = rawItem.comments.map((c) => {
      const { email: commentEmail, ...commentUserWithoutEmail } = c.user
      return {
        ...c,
        user: {
          ...commentUserWithoutEmail,
          emailHash: getEmailHash(commentEmail),
        },
      }
    })

    return { ...rawItem, user: itemUser, comments }
  } catch (error: unknown) {
    console.error('Erreur lors de la mise à jour du statut:', error)

    if (isHttpError(error)) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur interne du serveur',
    })
  }
})
