import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { misesAJourDuProfil } from '#server/utils/infos-personnelles'
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

    // La déclaration remonte au profil, qui fait foi. C'est l'intéressé qui remplit : ses
    // corrections doivent y être portées, pas seulement combler des vides — sinon le profil
    // garderait l'ancienne valeur et, faisant foi à la lecture, annulerait la modification.
    const profil = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        dietaryPreference: true,
        allergies: true,
        allergySeverity: true,
      },
    })
    const majProfil = misesAJourDuProfil(profil as never, data as never, { estLInteresse: true })
    if (Object.keys(majProfil).length) {
      await prisma.user.update({ where: { id: user.id }, data: majProfil as never })
    }

    // La fiche artiste n'est plus alimentée : ces informations vivent sur le profil, où elles
    // viennent d'être écrites. La vérification d'appartenance à l'édition reste, elle : c'est
    // elle qui autorise l'appel.
    const updated = {
      dietaryPreference: data.dietaryPreference,
      allergies: data.allergies,
      allergySeverity: data.allergySeverity,
    }

    return createSuccessResponse(updated)
  },
  { operationName: 'UpdateMyDiet' }
)
