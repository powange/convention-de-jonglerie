import { requireAuth } from '#server/utils/auth-utils'
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
        message: 'Droits insuffisants pour gérer les articles à remettre',
      })

    // La fonctionnalité éteinte refuse les écritures. Après le contrôle des droits : qui n'a
    // pas le droit d'être là ne doit pas apprendre au passage ce que l'édition a activé.
    await exigerArticlesARemettreActifs(editionId)

    // Vérifier que l'association existe et appartient à l'édition
    const item = await prisma.editionVolunteerHandoutItem.findFirst({
      where: {
        id: itemId,
        editionId,
      },
    })

    if (!item) {
      throw createError({
        status: 404,
        message: 'Association introuvable',
      })
    }

    // Supprimer l'association
    await prisma.editionVolunteerHandoutItem.delete({
      where: { id: itemId },
    })

    return createSuccessResponse(null, 'Article retiré des bénévoles avec succès')
  },
  { operationName: 'DELETE ticketing volunteers handout item' }
)
