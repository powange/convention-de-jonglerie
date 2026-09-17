import { requireAuth } from '#server/utils/auth-utils'
import { listHandoutItemsWithAssociationCounts } from '#server/utils/editions/ticketing/handout-items'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })

    try {
      // Chaque article porte le décompte de ce que sa suppression détacherait : la confirmation
      // en a besoin, et l'obtenir ici évite un aller-retour au moment du clic.
      const handoutItems = await listHandoutItemsWithAssociationCounts(editionId)

      return createSuccessResponse({ handoutItems })
    } catch (error: unknown) {
      console.error('Failed to fetch handout items:', error)
      throw createError({
        status: 500,
        message: 'Erreur lors de la récupération des articles à remettre',
      })
    }
  },
  { operationName: 'GET ticketing handout-items' }
)
