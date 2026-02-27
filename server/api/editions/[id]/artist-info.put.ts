import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { invalidateEditionCache } from '#server/utils/cache-helpers'
import {
  getEditionWithPermissions,
  canManageArtists,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

const updateArtistInfoSchema = z.object({
  artistInfo: z
    .string()
    .max(10000, 'Les informations artistes ne peuvent pas dépasser 10000 caractères')
    .nullable(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier les permissions de gestion des artistes
    const edition = await getEditionWithPermissions(editionId, { userId: user.id })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    if (!canManageArtists(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas autorisé à gérer les artistes de cette édition",
      })
    }

    const body = await readBody(event)
    const { artistInfo } = updateArtistInfoSchema.parse(body)

    const updated = await prisma.edition.update({
      where: { id: editionId },
      data: { artistInfo },
      select: { id: true, artistInfo: true },
    })

    await invalidateEditionCache(editionId)

    return createSuccessResponse(updated)
  },
  { operationName: 'UpdateArtistInfo' }
)
