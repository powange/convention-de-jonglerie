import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      message: 'Non authentifié',
    })
  }
  const user = event.context.user

  const editionId = parseInt(getRouterParam(event, 'id')!)
  const postId = parseInt(getRouterParam(event, 'postId')!)
  const commentId = parseInt(getRouterParam(event, 'commentId')!)

  if (isNaN(editionId) || isNaN(postId) || isNaN(commentId)) {
    throw createError({
      statusCode: 400,
      message: 'ID invalide',
    })
  }

  try {
    // Vérifier que le commentaire existe et appartient à l'utilisateur
    const comment = await prisma.editionPostComment.findFirst({
      where: {
        id: commentId,
        editionPostId: postId,
        userId: user.id,
      },
      include: {
        editionPost: {
          select: { editionId: true },
        },
      },
    })

    if (!comment || comment.editionPost.editionId !== editionId) {
      throw createError({
        statusCode: 404,
        message: "Commentaire non trouvé ou vous n'êtes pas autorisé à le supprimer",
      })
    }

    // Supprimer le commentaire
    await prisma.editionPostComment.delete({
      where: { id: commentId },
    })

    return { success: true, message: 'Commentaire supprimé avec succès' }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    console.error('Erreur lors de la suppression du commentaire:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur interne du serveur',
    })
  }
})
