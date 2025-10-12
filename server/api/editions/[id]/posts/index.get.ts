import { getEmailHash } from '@@/server/utils/email-hash'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const editionId = parseInt(getRouterParam(event, 'id')!)

  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      message: "ID d'édition invalide",
    })
  }

  try {
    // Vérifier que l'édition existe
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Édition non trouvée',
      })
    }

    // Récupérer les posts avec leurs commentaires et auteurs
    const posts = await prisma.editionPost.findMany({
      where: { editionId },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            profilePicture: true,
            email: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                profilePicture: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Transformer les emails en emailHash
    const transformedPosts = posts.map((post) => {
      const { email: postUserEmail, ...postUserWithoutEmail } = post.user
      return {
        ...post,
        user: {
          ...postUserWithoutEmail,
          emailHash: getEmailHash(postUserEmail),
        },
        comments: post.comments.map((comment) => {
          const { email: commentUserEmail, ...commentUserWithoutEmail } = comment.user
          return {
            ...comment,
            user: {
              ...commentUserWithoutEmail,
              emailHash: getEmailHash(commentUserEmail),
            },
          }
        }),
      }
    })

    return transformedPosts
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    console.error('Erreur lors de la récupération des posts:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur interne du serveur',
    })
  }
})
