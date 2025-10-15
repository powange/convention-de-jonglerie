import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const itemId = parseInt(getRouterParam(event, 'itemId') || '0')

  if (!editionId || !itemId) {
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })
  }

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour gérer les articles à restituer',
    })

  try {
    // Vérifier que l'association existe et appartient à l'édition
    const item = await prisma.editionVolunteerReturnableItem.findFirst({
      where: {
        id: itemId,
        editionId,
      },
    })

    if (!item) {
      throw createError({
        statusCode: 404,
        message: 'Association introuvable',
      })
    }

    // Supprimer l'association
    await prisma.editionVolunteerReturnableItem.delete({
      where: { id: itemId },
    })

    return {
      success: true,
      message: 'Article retiré des bénévoles avec succès',
    }
  } catch (error: unknown) {
    console.error("Erreur lors de la suppression de l'article pour bénévoles:", error)
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: "Erreur lors de la suppression de l'article",
    })
  }
})
