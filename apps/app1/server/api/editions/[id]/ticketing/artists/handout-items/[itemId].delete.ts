import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'

/**
 * Retire un article à remettre de la liste applicable à tous les artistes.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const itemId = validateResourceId(event, 'itemId', 'item')

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer les articles à remettre',
      })

    // Vérifier que l'association existe et appartient à l'édition
    const item = await prisma.editionArtistHandoutItem.findFirst({
      where: { id: itemId, editionId },
    })

    if (!item) {
      throw createError({
        status: 404,
        message: 'Association introuvable',
      })
    }

    await prisma.editionArtistHandoutItem.delete({ where: { id: itemId } })

    return createSuccessResponse(null, 'Article retiré des artistes avec succès')
  },
  { operationName: 'DELETE ticketing artists handout item' }
)
