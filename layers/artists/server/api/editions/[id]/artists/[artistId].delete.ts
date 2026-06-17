import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canEditEdition,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const artistId = validateResourceId(event, 'artistId', 'artiste')

    // Vérifier les permissions (util core via #server ; le layer ne lit pas Edition directement)
    const edition = await getEditionWithPermissions(editionId, { userId: user.id })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    const hasPermission = canEditEdition(edition, user)
    if (!hasPermission) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas autorisé à gérer les artistes de cette édition",
      })
    }

    // Vérifier que l'artiste existe et appartient à cette édition
    const existingArtist = await prisma.editionArtist.findFirst({
      where: {
        id: artistId,
        editionId,
      },
    })

    if (!existingArtist) {
      throw createError({
        status: 404,
        message: 'Artiste non trouvé',
      })
    }

    // Supprimer l'artiste (les associations avec les spectacles seront supprimées en cascade)
    await prisma.editionArtist.delete({
      where: { id: artistId },
    })

    return createSuccessResponse(null, 'Artiste supprimé avec succès')
  },
  { operationName: 'DeleteArtist' }
)
