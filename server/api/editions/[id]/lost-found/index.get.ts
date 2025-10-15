import { isHttpError } from '@@/server/types/prisma-helpers'
import { getEmailHash } from '@@/server/utils/email-hash'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const editionId = parseInt(getRouterParam(event, 'id') as string)

    if (!editionId || isNaN(editionId)) {
      throw createError({
        statusCode: 400,
        message: "ID d'édition invalide",
      })
    }

    // Vérifier que l'édition existe
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true, endDate: true },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Édition non trouvée',
      })
    }

    // Récupérer tous les objets trouvés de l'édition
    const rawItems = await prisma.lostFoundItem.findMany({
      where: { editionId },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
            profilePicture: true,
            email: true,
            updatedAt: true,
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
                email: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    const items = rawItems.map((item) => {
      const { email, ...userWithoutEmail } = item.user
      const user = {
        ...userWithoutEmail,
        emailHash: getEmailHash(email),
      }

      const comments = item.comments.map((c) => {
        const { email: commentEmail, ...commentUserWithoutEmail } = c.user
        return {
          ...c,
          user: {
            ...commentUserWithoutEmail,
            emailHash: getEmailHash(commentEmail),
          },
        }
      })

      return { ...item, user, comments }
    })
    return items
  } catch (error: unknown) {
    console.error('Erreur lors de la récupération des objets trouvés:', error)

    if (isHttpError(error)) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur interne du serveur',
    })
  }
})
