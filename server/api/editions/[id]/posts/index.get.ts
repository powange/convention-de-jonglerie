import { PrismaClient } from '@prisma/client'

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
            profilePicture: true
          }
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                profilePicture: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return posts
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