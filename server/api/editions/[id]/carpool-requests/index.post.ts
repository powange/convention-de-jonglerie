import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { userWithNameSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { carpoolRequestSchema } from '#server/utils/validation-schemas'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)
    const body = await readBody(event)

    // Validation des données avec Zod
    const validatedData = carpoolRequestSchema.parse(body)

    // Vérifier que l'édition existe
    await fetchResourceOrFail(prisma.edition, editionId, {
      errorMessage: 'Edition non trouvée',
    })

    // Créer la demande de covoiturage
    const carpoolRequest = await prisma.carpoolRequest.create({
      data: {
        editionId,
        userId: user.id,
        tripDate: new Date(validatedData.tripDate),
        locationCity: validatedData.locationCity,
        seatsNeeded: validatedData.seatsNeeded,
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

    return createSuccessResponse(carpoolRequest)
  },
  { operationName: 'CreateCarpoolRequest' }
)
