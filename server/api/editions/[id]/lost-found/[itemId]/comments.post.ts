import { createHash } from 'node:crypto'

import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  try {
    const editionId = parseInt(getRouterParam(event, 'id') as string)
    const itemId = parseInt(getRouterParam(event, 'itemId') as string)
    const body = await readBody(event)

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

    // Valider le contenu
    const { content } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Le contenu du commentaire est requis',
      })
    }

    // Créer le commentaire
    const rawComment = await prisma.lostFoundComment.create({
      data: {
        lostFoundItemId: itemId,
        userId,
        content: content.trim(),
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
      },
    })
    const email = (rawComment.user as any).email as string | undefined
    const emailHash = email
      ? createHash('md5').update(email.trim().toLowerCase()).digest('hex')
      : undefined
    const commentUser = { ...rawComment.user, emailHash }
    delete (commentUser as any).email
    return { ...rawComment, user: commentUser }
  } catch (error: unknown) {
    console.error('Erreur lors de la création du commentaire:', error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error as unknown as Error
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur interne du serveur',
    })
  }
})
