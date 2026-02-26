import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

const updateAccommodationSchema = z.object({
  accommodationAutonomous: z.boolean(),
  accommodationType: z.enum(['TENT', 'VEHICLE', 'HOSTED', 'OTHER']).nullable(),
  accommodationTypeOther: z
    .string()
    .max(500)
    .transform((v) => v?.trim() || null)
    .nullable(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const body = await readBody(event)
    const data = updateAccommodationSchema.parse(body)

    // Si le type n'est pas OTHER, supprimer le texte libre
    if (data.accommodationType !== 'OTHER') {
      data.accommodationTypeOther = null
    }

    // Si non autonome, seul l'orga peut renseigner le type → on ne touche pas au type
    if (!data.accommodationAutonomous) {
      data.accommodationType = null
      data.accommodationTypeOther = null
    }

    // Récupérer l'artiste de l'utilisateur pour cette édition
    const artist = await prisma.editionArtist.findUnique({
      where: {
        editionId_userId: {
          editionId,
          userId: user.id,
        },
      },
    })

    if (!artist) {
      throw createError({
        status: 404,
        message: "Vous n'êtes pas artiste pour cette édition",
      })
    }

    // Mettre à jour l'hébergement
    const updated = await prisma.editionArtist.update({
      where: { id: artist.id },
      data: {
        accommodationAutonomous: data.accommodationAutonomous,
        accommodationType: data.accommodationType,
        accommodationTypeOther: data.accommodationTypeOther,
      },
      select: {
        accommodationAutonomous: true,
        accommodationType: true,
        accommodationTypeOther: true,
      },
    })

    return createSuccessResponse(updated)
  },
  { operationName: 'UpdateMyAccommodation' }
)
