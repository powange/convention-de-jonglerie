import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const customFieldId = validateResourceId(event, 'customFieldId', 'custom field')

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    // Vérifier que le custom field existe et appartient à l'édition
    const customField = await prisma.ticketingTierCustomField.findFirst({
      where: {
        id: customFieldId,
        editionId,
      },
    })

    if (!customField) {
      throw createError({
        status: 404,
        message: 'Custom field introuvable',
      })
    }

    // Vérifier qu'il ne vient pas de HelloAsso (non supprimable)
    if (customField.helloAssoCustomFieldId !== null) {
      throw createError({
        status: 403,
        message: 'Les custom fields synchronisés depuis HelloAsso ne peuvent pas être supprimés',
      })
    }

    // Supprimer le custom field (les associations seront supprimées automatiquement grâce à onDelete: Cascade)
    await prisma.ticketingTierCustomField.delete({
      where: { id: customFieldId },
    })

    return createSuccessResponse(null, 'Custom field supprimé avec succès')
  },
  { operationName: 'DELETE ticketing custom field' }
)
