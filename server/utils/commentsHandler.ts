import { createError, getRouterParam, readBody } from 'h3'

import { carpoolUserSelect } from './prisma-select-helpers'

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
      throw createError({ status: 400, message: 'ID manquant' })
    }

    const parsedId = parseInt(rawId)
    if (isNaN(parsedId)) {
      const msg =
        config.entityType === 'carpoolOffer'
          ? "ID de l'offre invalide"
          : 'ID de la demande invalide'
      throw createError({ status: 400, message: msg })
    }

    // Construire la requête where dynamiquement (avec ID numérique)
    const whereClause: any = {}
    whereClause[config.entityIdField] = parsedId

    // Choisir le bon modèle Prisma selon le type d'entité
    const modelName =
      config.entityType === 'carpoolOffer' ? 'carpoolComment' : 'carpoolRequestComment'
    const model: any = (prisma as any)[modelName]

    // Récupérer les commentaires
    const comments = await model.findMany({
      where: whereClause,
      include: {
        user: {
          select: carpoolUserSelect,
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    // emailHash est déjà présent via le select
    return comments
  } catch (error: any) {
    console.error(
      `Erreur lors de la récupération des commentaires pour ${config.entityType}:`,
      error
    )

    if (error.statusCode) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Erreur serveur',
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
        status: 401,
        message: 'Authentification requise',
      })
    }

    const rawId = getRouterParam(event, 'id')
    if (!rawId) {
      throw createError({ status: 400, message: 'ID manquant' })
    }

    const parsedId = parseInt(rawId)
    if (isNaN(parsedId)) {
      throw createError({ status: 400, message: 'ID manquant' })
    }

    // Vérifier que la ressource parente existe
    const parentModelName = config.entityType === 'carpoolOffer' ? 'carpoolOffer' : 'carpoolRequest'
    const parentModel: any = (prisma as any)[parentModelName]
    const parentExists = await parentModel.findUnique({
      where: { id: parsedId },
      select: { id: true },
    })

    if (!parentExists) {
      const errorMsg =
        config.entityType === 'carpoolOffer'
          ? 'Offre de covoiturage non trouvée'
          : 'Demande de covoiturage non trouvée'
      throw createError({ status: 404, message: errorMsg })
    }

    const body = await readBody(event)

    if (!body.content || !body.content.trim()) {
      throw createError({
        status: 400,
        message: 'Le contenu du commentaire est requis',
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
          select: carpoolUserSelect,
        },
      },
    })

    return comment
  } catch (error: any) {
    console.error(`Erreur lors de la création du commentaire pour ${config.entityType}:`, error)

    if (error.statusCode) {
      throw error
    }

    throw createError({
      status: 500,
      message: 'Erreur lors de la création du commentaire',
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
        status: 401,
        message: 'Authentification requise',
      })
    }

    const commentIdRaw = getRouterParam(event, 'commentId')
    if (!commentIdRaw) {
      throw createError({ status: 400, message: 'ID du commentaire manquant' })
    }

    const commentId = parseInt(commentIdRaw)
    if (isNaN(commentId)) {
      throw createError({ status: 400, message: 'ID du commentaire manquant' })
    }

    // Vérifier que le commentaire existe et appartient à l'utilisateur
    const comment = await prisma.carpoolComment.findUnique({
      where: { id: commentId },
      select: { userId: true },
    })

    if (!comment) {
      throw createError({
        status: 404,
        message: 'Commentaire non trouvé',
      })
    }

    if (comment.userId !== event.context.user?.id) {
      throw createError({
        status: 403,
        message: 'Vous ne pouvez supprimer que vos propres commentaires',
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
      status: 500,
      message: 'Erreur lors de la suppression du commentaire',
    })
  }
}
