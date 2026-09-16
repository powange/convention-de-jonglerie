import { requireAuth } from '#server/utils/auth-utils'
import { deleteHandoutItem } from '#server/utils/editions/ticketing/handout-items'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { exigerArticlesARemettreActifs } from '#server/utils/ticketing/handout-items-actifs'

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
        message: 'Droits insuffisants pour modifier ces données',
      })

    // La fonctionnalité éteinte refuse les écritures. Après le contrôle des droits : qui n'a
    // pas le droit d'être là ne doit pas apprendre au passage ce que l'édition a activé.
    await exigerArticlesARemettreActifs(editionId)

    return createSuccessResponse(await deleteHandoutItem(itemId, editionId))
  },
  { operationName: 'DELETE ticketing handout item' }
)
