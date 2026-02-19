import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

const updateDietSchema = z.object({
  dietaryPreference: z.enum(['NONE', 'VEGETARIAN', 'VEGAN']),
  allergies: z
    .string()
    .transform((v) => v?.trim() || null)
    .nullable(),
  allergySeverity: z.enum(['LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL']).nullable(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const body = await readBody(event)
    const data = updateDietSchema.parse(body)

    // Si pas d'allergies, supprimer la sévérité
    if (!data.allergies) {
      data.allergySeverity = null
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

    // Mettre à jour les préférences alimentaires
    const updated = await prisma.editionArtist.update({
      where: { id: artist.id },
      data: {
        dietaryPreference: data.dietaryPreference,
        allergies: data.allergies,
        allergySeverity: data.allergySeverity,
      },
      select: {
        dietaryPreference: true,
        allergies: true,
        allergySeverity: true,
      },
    })

    return {
      success: true,
      ...updated,
    }
  },
  { operationName: 'UpdateMyDiet' }
)
