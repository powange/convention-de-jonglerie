import { requireAuth } from '@@/server/utils/auth-utils'
import {
  getEditionWithPermissions,
  canEditEdition,
} from '@@/server/utils/permissions/edition-permissions'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id')!)
  const postId = parseInt(getRouterParam(event, 'postId')!)

  if (isNaN(editionId) || isNaN(postId)) {
    throw createError({
      statusCode: 400,
      message: 'ID invalide',
    })
  }

  // Lire le body pour savoir si on épingle ou désépingle
  const body = await readBody(event)
  const { pinned } = body

  if (typeof pinned !== 'boolean') {
    throw createError({
      statusCode: 400,
      message: 'Le champ "pinned" est requis et doit être un booléen',
    })
  }

  try {
    // Vérifier que l'édition existe et que l'utilisateur a les droits d'édition
    const edition = await getEditionWithPermissions(editionId, {
      userId: user.id,
      requiredRights: ['canEditAllEditions', 'canEditConvention'],
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Édition non trouvée',
      })
    }

    if (!canEditEdition(edition, user)) {
      throw createError({
        statusCode: 403,
        message: "Vous n'avez pas les droits pour épingler des publications sur cette édition",
      })
    }

    // Vérifier que le post existe et appartient bien à cette édition
    const post = await prisma.editionPost.findFirst({
      where: {
        id: postId,
        editionId,
      },
    })

    if (!post) {
      throw createError({
        statusCode: 404,
        message: 'Publication non trouvée',
      })
    }

    // Mettre à jour le statut d'épinglage
    const updatedPost = await prisma.editionPost.update({
      where: { id: postId },
      data: { pinned },
    })

    return {
      success: true,
      message: pinned ? 'Publication épinglée avec succès' : 'Publication désépinglée avec succès',
      post: updatedPost,
    }
  } catch (error: any) {
    if (error.statusCode) {
      throw error
    }

    console.error("Erreur lors de la modification de l'épinglage:", error)
    throw createError({
      statusCode: 500,
      message: 'Erreur interne du serveur',
    })
  }
})
