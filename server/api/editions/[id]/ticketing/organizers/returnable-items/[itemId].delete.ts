import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const itemId = validateResourceId(event, 'itemId', 'item')

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour gérer les articles à restituer',
      })

    // Vérifier que l'association existe et appartient à l'édition
    const item = await prisma.editionOrganizerReturnableItem.findFirst({
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
    await prisma.editionOrganizerReturnableItem.delete({
      where: { id: itemId },
    })

    return createSuccessResponse(null, 'Article retiré des organisateurs avec succès')
  },
  { operationName: 'DELETE ticketing organizers returnable item' }
)
