import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'
import { fetchResourceOrFail, buildUpdateData } from '@@/server/utils/prisma-helpers'
import { carpoolOfferInclude } from '@@/server/utils/prisma-select-helpers'
import { validateResourceId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

const updateCarpoolOfferSchema = z.object({
  tripDate: z.string().optional(),
  locationCity: z.string().min(1, 'La ville de départ est requise').optional(),
  locationAddress: z.string().min(1, "L'adresse de départ est requise").optional(),
  availableSeats: z
    .number()
    .int()
    .min(1, 'Au moins 1 place disponible')
    .max(8, 'Maximum 8 places')
    .optional(),
  description: z.string().max(500, 'Description trop longue (500 caractères max)').optional(),
  phoneNumber: z.string().max(20, 'Numéro de téléphone trop long').optional().nullable(),
  smokingAllowed: z.boolean().optional(),
  petsAllowed: z.boolean().optional(),
  musicAllowed: z.boolean().optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const offerId = validateResourceId(event, 'id', 'offre')

    const body = await readBody(event)

    // Valider les données
    const validatedData = updateCarpoolOfferSchema.parse(body)

    // Vérifier que l'offre existe
    const existingOffer = await fetchResourceOrFail(prisma.carpoolOffer, offerId, {
      include: {
        user: {
          select: { id: true, pseudo: true },
        },
      },
      errorMessage: 'Offre de covoiturage introuvable',
    })

    // Seul le créateur peut modifier son offre
    if (existingOffer.userId !== user.id) {
      throw createError({
        statusCode: 403,
        message: "Vous n'avez pas les droits pour modifier cette offre",
      })
    }

    // Construire les données de mise à jour
    const updateData = buildUpdateData(validatedData, {
      trimStrings: true,
      transform: {
        tripDate: (val) => new Date(val),
      },
    })

    // Mettre à jour l'offre
    const updatedOffer = await prisma.carpoolOffer.update({
      where: { id: offerId },
      data: updateData,
      include: carpoolOfferInclude,
    })

    return updatedOffer
  },
  { operationName: 'UpdateCarpoolOffer' }
)
