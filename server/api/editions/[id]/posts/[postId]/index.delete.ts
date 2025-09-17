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

  if (isNaN(editionId) || isNaN(postId)) {
    throw createError({
      statusCode: 400,
      message: 'ID invalide',
    })
  }

  try {
    // Vérifier que le post existe et appartient à l'utilisateur
    const post = await prisma.editionPost.findFirst({
      where: {
        id: postId,
        editionId,
        userId: user.id,
      },
    })

    if (!post) {
      throw createError({
        statusCode: 404,
        message: "Post non trouvé ou vous n'êtes pas autorisé à le supprimer",
      })
    }

    // Supprimer le post (les commentaires seront supprimés automatiquement grâce à onDelete: Cascade)
    await prisma.editionPost.delete({
      where: { id: postId },
    })

    return { success: true, message: 'Post supprimé avec succès' }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    console.error('Erreur lors de la suppression du post:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur interne du serveur',
    })
  }
})
