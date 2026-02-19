import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Retourne si l'utilisateur connecté est un artiste enregistré pour cette édition
 * Route optimisée pour vérifier rapidement le statut artiste (utilisée par le Header)
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const artist = await prisma.editionArtist.findUnique({
      where: {
        editionId_userId: {
          editionId,
          userId: user.id,
        },
      },
      select: { id: true },
    })

    return { isArtist: !!artist }
  },
  { operationName: 'GetMyArtistStatus' }
)
