import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageArtistsById,
  canManageTicketingById,
} from '#server/utils/permissions/edition-permissions'
import {
  showCompositionInclude,
  showPerformancesInclude,
} from '#server/utils/prisma-select-helpers'
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
        ...showPerformancesInclude,
      },
    })

    // La date vit désormais dans les représentations. Prisma ne sait pas trier sur un champ
    // d'une relation à plusieurs, et la première représentation est ce qui situe un spectacle
    // dans la programmation : le tri se fait donc ici. Un spectacle sans représentation ne
    // devrait pas exister — s'il en surgit un, il passe en fin de liste plutôt que de fausser
    // l'ordre des autres.
    // Le spread des `include` partagés fait perdre à Prisma l'inférence des relations : le
    // résultat est typé comme un objet indexé, où `performances` n'a plus sa forme. On la
    // nomme donc ici pour trier, plutôt que de renoncer à l'ordre chronologique.
    type AvecPassages = { title: string; performances: { startDateTime: Date }[] }
    const debutDe = (show: AvecPassages) =>
      show.performances[0]?.startDateTime?.getTime() ?? Number.POSITIVE_INFINITY

    const tries = [...(shows as unknown as AvecPassages[])].sort(
      (a, b) => debutDe(a) - debutDe(b) || a.title.localeCompare(b.title)
    )

    return createSuccessResponse({ shows: tries })
  },
  { operationName: 'GetEditionShows' }
)
