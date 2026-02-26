import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  organizerNotes: z.string().nullable(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)
    const artistId = validateResourceId(event, 'artistId', 'artiste')

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: "Droits insuffisants pour modifier les notes de l'organisateur",
      })
    }

    const body = bodySchema.parse(await readBody(event))

    // Vérifier que l'artiste appartient bien à cette édition
    const artist = await prisma.editionArtist.findFirst({
      where: {
        id: artistId,
        editionId,
      },
    })

    if (!artist) {
      throw createError({
        status: 404,
        message: 'Artiste introuvable pour cette édition',
      })
    }

    // Mettre à jour les notes
    const updatedArtist = await prisma.editionArtist.update({
      where: {
        id: artistId,
      },
      data: {
        organizerNotes: body.organizerNotes,
      },
    })

    return createSuccessResponse({ artist: updatedArtist })
  },
  { operationName: 'UpdateArtistNotes' }
)
