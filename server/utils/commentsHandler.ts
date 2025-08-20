import type { H3Event } from 'h3'
import { prisma } from './prisma'
import { createEmailHash } from './email-hash'

export type CommentEntityType = 'carpoolOffer' | 'carpoolRequest'

export interface CommentConfig {
  entityType: CommentEntityType
  entityIdField: string
  includeQuery?: any
}

export async function getCommentsForEntity(
  event: H3Event,
  config: CommentConfig
) {
  try {
    const entityId = getRouterParam(event, 'id')
    if (!entityId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID manquant'
      })
    }

    // Construire la requête where dynamiquement
    const whereClause: any = {}
    whereClause[config.entityIdField] = entityId

    // Récupérer les commentaires
    const comments = await prisma.carpoolComment.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            nom: true,
            prenom: true,
            email: true,
            profilePicture: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transformer les données pour inclure emailHash et masquer l'email
    const transformedComments = comments.map(comment => ({
      ...comment,
      author: comment.user ? {
        id: comment.user.id,
        pseudo: comment.user.pseudo,
        nom: comment.user.nom,
        prenom: comment.user.prenom,
        profilePicture: comment.user.profilePicture,
        emailHash: createEmailHash(comment.user.email),
      } : null,
      user: undefined
    }))

    return transformedComments

  } catch (error: any) {
    console.error(`Erreur lors de la récupération des commentaires pour ${config.entityType}:`, error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la récupération des commentaires'
    })
  }
}

export async function createCommentForEntity(
  event: H3Event,
  config: CommentConfig & { requireAuth?: boolean }
) {
  try {
    // Vérification de l'authentification si requise
    if (config.requireAuth && !event.context.user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentification requise'
      })
    }

    const entityId = getRouterParam(event, 'id')
    if (!entityId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID manquant'
      })
    }

    const body = await readBody(event)
    
    if (!body.content || !body.content.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Le contenu du commentaire est requis'
      })
    }

    // Construire les données du commentaire dynamiquement
    const commentData: any = {
      content: body.content.trim(),
      userId: event.context.user?.id
    }
    commentData[config.entityIdField] = entityId

    // Créer le commentaire
    const comment = await prisma.carpoolComment.create({
      data: commentData,
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            nom: true,
            prenom: true,
            email: true,
            profilePicture: true
          }
        }
      }
    })

    // Transformer la réponse
    return {
      ...comment,
      author: comment.user ? {
        id: comment.user.id,
        pseudo: comment.user.pseudo,
        nom: comment.user.nom,
        prenom: comment.user.prenom,
        profilePicture: comment.user.profilePicture,
        emailHash: createEmailHash(comment.user.email),
      } : null,
      user: undefined
    }

  } catch (error: any) {
    console.error(`Erreur lors de la création du commentaire pour ${config.entityType}:`, error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la création du commentaire'
    })
  }
}

export async function deleteCommentForEntity(
  event: H3Event,
  config: CommentConfig & { requireAuth?: boolean }
) {
  try {
    // Vérification de l'authentification
    if (config.requireAuth && !event.context.user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Authentification requise'
      })
    }

    const commentId = getRouterParam(event, 'commentId')
    if (!commentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'ID du commentaire manquant'
      })
    }

    // Vérifier que le commentaire existe et appartient à l'utilisateur
    const comment = await prisma.carpoolComment.findUnique({
      where: { id: parseInt(commentId) },
      select: { userId: true }
    })

    if (!comment) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Commentaire non trouvé'
      })
    }

    if (comment.userId !== event.context.user?.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Vous ne pouvez supprimer que vos propres commentaires'
      })
    }

    // Supprimer le commentaire
    await prisma.carpoolComment.delete({
      where: { id: parseInt(commentId) }
    })

    return {
      success: true,
      message: 'Commentaire supprimé avec succès'
    }

  } catch (error: any) {
    console.error(`Erreur lors de la suppression du commentaire:`, error)
    
    if (error.statusCode) {
      throw error
    }
    
    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la suppression du commentaire'
    })
  }
}