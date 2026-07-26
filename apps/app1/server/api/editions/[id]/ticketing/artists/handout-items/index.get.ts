import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'

/**
 * Liste les articles à remettre associés à TOUS les artistes de l'édition.
 * Les articles associés à un spectacle précis sont gérés séparément
 * (ShowHandoutItem, via les endpoints des spectacles).
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    const items = await prisma.editionArtistHandoutItem.findMany({
      where: { editionId },
      include: {
        handoutItem: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return {
      items: items.map((item) => ({
        id: item.id,
        handoutItemId: item.handoutItemId,
        handoutItemName: item.handoutItem.name,
        quantity: item.quantity,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })),
    }
  },
  { operationName: 'GET ticketing artists handout-items index' }
)
