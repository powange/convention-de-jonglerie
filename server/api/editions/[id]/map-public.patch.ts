import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getEditionForEdit } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

const mapPublicSchema = z.object({
  mapPublic: z.boolean(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const body = await readBody(event)
    const validatedData = mapPublicSchema.parse(body)

    // Récupère l'édition et vérifie les permissions d'édition
    await getEditionForEdit(editionId, user)

    const updatedEdition = await prisma.edition.update({
      where: { id: editionId },
      data: { mapPublic: validatedData.mapPublic },
      select: { id: true, mapPublic: true },
    })

    return createSuccessResponse(updatedEdition)
  },
  { operationName: 'UpdateEditionMapPublic' }
)
