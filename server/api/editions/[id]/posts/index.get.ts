import { PrismaClient } from '@prisma/client'
import { getEmailHash } from '../../../../utils/email-hash'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const editionId = parseInt(getRouterParam(event, 'id')!)
  
  if (isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ID d\'édition invalide'
    })
  }

  try {
    // Vérifier que l'édition existe
    const edition = await prisma.edition.findUnique({
      where: { id: editionId }
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Édition non trouvée'
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
            email: true
          }
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                profilePicture: true,
                email: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Transformer les emails en emailHash
    const transformedPosts = posts.map(post => ({
      ...post,
      user: {
        ...post.user,
        emailHash: getEmailHash(post.user.email),
        email: undefined
      } as any,
      comments: post.comments.map(comment => ({
        ...comment,
        user: {
          ...comment.user,
          emailHash: getEmailHash(comment.user.email),
          email: undefined
        } as any
      }))
    }))

    return transformedPosts
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }
    
    console.error('Erreur lors de la récupération des posts:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur interne du serveur'
    })
  }
})