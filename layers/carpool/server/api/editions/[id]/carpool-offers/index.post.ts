import { coordonneesPourCreation } from '../../../../utils/coordonnees-annonce'

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

    // La coordonnée de la ville : celle que le formulaire a retenue, ou un géocodage de repli.
    // `null` ne doit jamais empêcher la création — voir `coordonnees-annonce.ts`.
    const coordonnees = await coordonneesPourCreation({
      ville: validatedData.locationCity,
      latitude: validatedData.latitude,
      longitude: validatedData.longitude,
    })

    // Créer l'offre de covoiturage
    const carpoolOffer = await prisma.carpoolOffer.create({
      data: {
        editionId,
        userId: user.id,
        tripDate: new Date(validatedData.tripDate),
        locationCity: validatedData.locationCity,
        locationAddress: validatedData.locationAddress,
        latitude: coordonnees.latitude,
        longitude: coordonnees.longitude,
        availableSeats: validatedData.availableSeats,
        direction: validatedData.direction,
        description: validatedData.description,
        phoneNumber: validatedData.phoneNumber,
        smokingAllowed: validatedData.smokingAllowed,
        petsAllowed: validatedData.petsAllowed,
        musicAllowed: validatedData.musicAllowed,
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
