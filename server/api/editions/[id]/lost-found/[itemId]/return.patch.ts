import { createHash } from 'node:crypto'

import { hasEditionEditPermission } from '../../../../../utils/permissions/permissions'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const { requireUserSession } = await import('#imports')
    const editionId = parseInt(getRouterParam(event, 'id') as string)
    const itemId = parseInt(getRouterParam(event, 'itemId') as string)

    if (!editionId || isNaN(editionId) || !itemId || isNaN(itemId)) {
      throw createError({
        statusCode: 400,
        message: 'ID invalide',
      })
    }

    // Vérifier l'authentification
    const { user } = await requireUserSession(event)
    const userId = user.id

    if (!userId) {
      throw createError({
        statusCode: 401,
        message: 'Token invalide',
      })
    }

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
    const email = (rawItem.user as any).email as string | undefined
    const emailHash = email
      ? createHash('md5').update(email.trim().toLowerCase()).digest('hex')
      : undefined
    const itemUser = { ...rawItem.user, emailHash }
    delete (itemUser as any).email
    const comments = rawItem.comments.map((c) => {
      const cEmail = (c.user as any).email as string | undefined
      const cHash = cEmail
        ? createHash('md5').update(cEmail.trim().toLowerCase()).digest('hex')
        : undefined
      const cUser = { ...c.user, emailHash: cHash }
      delete (cUser as any).email
      return { ...c, user: cUser }
    })
    return { ...rawItem, user: itemUser, comments }
  } catch (error) {
    console.error('Erreur lors de la mise à jour du statut:', error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur interne du serveur',
    })
  }
})
