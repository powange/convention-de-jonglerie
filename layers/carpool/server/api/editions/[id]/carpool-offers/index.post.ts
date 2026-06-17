import { useCarpoolPorts } from '#server/carpool/ports/registry'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { userWithNameSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { carpoolOfferSchema } from '#server/utils/validation-schemas'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)
    const body = await readBody(event)

    // Validation des données avec Zod
    const validatedData = carpoolOfferSchema.parse(body)

    // Vérifier que l'événement existe (via le port ; le layer ne lit pas Edition directement)
    const exists = await useCarpoolPorts().event.eventExists(editionId)
    if (!exists) {
      throw createError({ status: 404, message: 'Edition non trouvée' })
    }

    // Créer l'offre de covoiturage
    const carpoolOffer = await prisma.carpoolOffer.create({
      data: {
        editionId,
        userId: user.id,
        tripDate: new Date(validatedData.tripDate),
        locationCity: validatedData.locationCity,
        locationAddress: validatedData.locationAddress,
        availableSeats: validatedData.availableSeats,
        direction: validatedData.direction,
        description: validatedData.description,
        phoneNumber: validatedData.phoneNumber,
      },
      include: {
        user: {
          select: userWithNameSelect,
        },
      },
    })

    return createSuccessResponse(carpoolOffer)
  },
  { operationName: 'CreateCarpoolOffer' }
)
