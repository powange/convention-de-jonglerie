import { createError, getRouterParam, readBody } from 'h3'

import { getEmailHash } from './email-hash'
import { prisma } from './prisma'

import type { H3Event } from 'h3'

export type CommentEntityType = 'carpoolOffer' | 'carpoolRequest'

export interface CommentConfig {
  entityType: CommentEntityType
  entityIdField: string
  includeQuery?: any
}

export async function getCommentsForEntity(event: H3Event, config: CommentConfig) {
  try {
    // Récupérer l'ID depuis les params et le parser en nombre
    const rawId = (event.context as any)?.params?.id
    if (!rawId) {
      throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
    }

    const parsedId = parseInt(rawId)
    if (isNaN(parsedId)) {
      const msg =
        config.entityType === 'carpoolOffer'
          ? "ID de l'offre invalide"
          : 'ID de la demande invalide'
      throw createError({ statusCode: 400, statusMessage: msg })
    }

    // Construire la requête where dynamiquement (avec ID numérique)
    const whereClause: any = {}
    whereClause[config.entityIdField] = parsedId

    // Choisir le bon modèle Prisma selon le type d'entité
    const modelName =
      config.entityType === 'carpoolOffer' ? 'carpoolComment' : 'carpoolRequestComment'
    const model: any = (prisma as any)[modelName]

    // Récupérer les commentaires (inclure l'utilisateur brut comme attendu par les tests)
    const comments = await model.findMany({
      where: whereClause,
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    })

    // Transformer les données pour ajouter emailHash et masquer l'email (conserver la clé `user`)
    const transformedComments = comments.map((comment) => ({
      ...comment,
      user: comment.user
        ? {
            id: comment.user.id,
            pseudo: comment.user.pseudo,
            profilePicture: comment.user.profilePicture ?? null,
            updatedAt: comment.user.updatedAt,
            emailHash: getEmailHash(comment.user.email),
          }
        : undefined,
    }))

    return transformedComments
  } catch (error: any) {
    console.error(
      `Erreur lors de la récupération des commentaires pour ${config.entityType}:`,
      error
    )

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur serveur',
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
        statusMessage: 'Authentification requise',
      })
    }

    const rawId = getRouterParam(event, 'id')
    if (!rawId) {
      throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
    }

    const parsedId = parseInt(rawId)
    if (isNaN(parsedId)) {
      throw createError({ statusCode: 400, statusMessage: 'ID manquant' })
    }

    const body = await readBody(event)

    if (!body.content || !body.content.trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Le contenu du commentaire est requis',
      })
    }

    // Construire les données du commentaire dynamiquement
    const commentData: any = {
      content: body.content.trim(),
      userId: event.context.user?.id,
    }
    commentData[config.entityIdField] = parsedId

    // Créer le commentaire
    const modelName =
      config.entityType === 'carpoolOffer' ? 'carpoolComment' : 'carpoolRequestComment'
    const model: any = (prisma as any)[modelName]

    const comment = await model.create({
      data: commentData,
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            nom: true,
            prenom: true,
            email: true,
            profilePicture: true,
          },
        },
      },
    })

    // Transformer la réponse
    return {
      ...comment,
      author: comment.user
        ? {
            id: comment.user.id,
            pseudo: comment.user.pseudo,
            nom: comment.user.nom,
            prenom: comment.user.prenom,
            profilePicture: comment.user.profilePicture,
            emailHash: getEmailHash(comment.user.email),
          }
        : null,
      user: undefined,
    }
  } catch (error: any) {
    console.error(`Erreur lors de la création du commentaire pour ${config.entityType}:`, error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la création du commentaire',
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
        statusMessage: 'Authentification requise',
      })
    }

    const commentIdRaw = getRouterParam(event, 'commentId')
    if (!commentIdRaw) {
      throw createError({ statusCode: 400, statusMessage: 'ID du commentaire manquant' })
    }

    const commentId = parseInt(commentIdRaw)
    if (isNaN(commentId)) {
      throw createError({ statusCode: 400, statusMessage: 'ID du commentaire manquant' })
    }

    // Vérifier que le commentaire existe et appartient à l'utilisateur
    const comment = await prisma.carpoolComment.findUnique({
      where: { id: commentId },
      select: { userId: true },
    })

    if (!comment) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Commentaire non trouvé',
      })
    }

    if (comment.userId !== event.context.user?.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Vous ne pouvez supprimer que vos propres commentaires',
      })
    }

    // Supprimer le commentaire
    await prisma.carpoolComment.delete({ where: { id: commentId } })

    return {
      success: true,
      message: 'Commentaire supprimé avec succès',
    }
  } catch (error: any) {
    console.error(`Erreur lors de la suppression du commentaire:`, error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la suppression du commentaire',
    })
  }
}
