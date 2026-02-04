import { wrapApiHandler, createSuccessResponse } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canEditWorkshop } from '@@/server/utils/permissions/workshop-permissions'
import { validateEditionId, validateResourceId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const workshopId = validateResourceId(event, 'workshopId', 'atelier')

    // Vérifier que le workshop existe et appartient à l'édition
    const workshop = await prisma.workshop.findFirst({
      where: {
        id: workshopId,
        editionId,
      },
    })

    if (!workshop) {
      throw createError({
        status: 404,
        message: 'Workshop non trouvé',
      })
    }

    // Vérifier les permissions pour supprimer le workshop
    const hasPermission = await canEditWorkshop(user.id, workshopId)
    if (!hasPermission) {
      throw createError({
        status: 403,
        message:
          "Vous n'êtes pas autorisé à supprimer ce workshop. Seuls le créateur ou les organisateurs peuvent le faire.",
      })
    }

    // Supprimer le workshop
    await prisma.workshop.delete({
      where: { id: workshopId },
    })

    return createSuccessResponse(null, 'Workshop supprimé avec succès')
  },
  { operationName: 'DeleteWorkshop' }
)
