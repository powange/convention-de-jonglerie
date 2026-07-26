import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageArtistsById,
  canManageTicketingById,
} from '#server/utils/permissions/edition-permissions'
import { showCompositionInclude, showZoneMarkerInclude } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Lecture ouverte à la gestion des artistes ET à celle de la billetterie :
    // la page des articles à remettre liste les spectacles pour leur en associer.
    const allowed =
      (await canManageArtistsById(editionId, user.id, event)) ||
      (await canManageTicketingById(editionId, user.id, event))
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })
    }

    const shows = await prisma.show.findMany({
      where: { editionId },
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
      orderBy: {
        startDateTime: 'asc',
      },
    })

    return createSuccessResponse({ shows })
  },
  { operationName: 'GetEditionShows' }
)
