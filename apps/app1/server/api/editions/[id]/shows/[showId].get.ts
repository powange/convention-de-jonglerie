import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { showCompositionInclude, showZoneMarkerInclude } from '#server/utils/prisma-select-helpers'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

/**
 * Un spectacle et sa composition complète.
 *
 * Évite à la page d'édition de charger la liste entière : sur une édition fournie, cela
 * transférait les artistes et les numéros de tous les autres spectacles à chaque ouverture.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const showId = validateResourceId(event, 'showId', 'spectacle')

    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })
    }

    const show = await prisma.show.findFirst({
      where: { id: showId, editionId },
      include: {
        ...showCompositionInclude,
        handoutItems: {
          include: {
            handoutItem: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        ...showZoneMarkerInclude,
      },
    })

    if (!show) {
      throw createError({
        status: 404,
        message: 'Spectacle non trouvé',
      })
    }

    return createSuccessResponse({ show })
  },
  { operationName: 'GetShow' }
)
