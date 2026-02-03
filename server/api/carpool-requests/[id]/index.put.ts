import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth, requireResourceOwner } from '@@/server/utils/auth-utils'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { carpoolRequestInclude } from '@@/server/utils/prisma-select-helpers'
import { validateResourceId } from '@@/server/utils/validation-helpers'
import { updateCarpoolRequestSchema } from '@@/server/utils/validation-schemas'

export default wrapApiHandler(
  async (event) => {
    requireAuth(event)
    const requestId = validateResourceId(event, 'id', 'demande')

    const body = await readBody(event)

    // Valider les données
    const validatedData = updateCarpoolRequestSchema.parse(body)

    // Vérifier que la demande existe et que l'utilisateur en est le créateur
    const existingRequest = await fetchResourceOrFail(prisma.carpoolRequest, requestId, {
      include: {
        user: {
          select: { id: true, pseudo: true },
        },
      },
      errorMessage: 'Demande de covoiturage introuvable',
    })

    // Seul le créateur peut modifier sa demande
    requireResourceOwner(event, existingRequest, {
      errorMessage: "Vous n'avez pas les droits pour modifier cette demande",
    })

    // Préparer les données à mettre à jour
    const updateData: any = {}

    if (validatedData.tripDate) {
      updateData.tripDate = new Date(validatedData.tripDate)
    }
    if (validatedData.locationCity) {
      updateData.locationCity = validatedData.locationCity.trim()
    }
    if (validatedData.seatsNeeded !== undefined) {
      updateData.seatsNeeded = validatedData.seatsNeeded
    }
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description?.trim() || null
    }
    if (validatedData.phoneNumber !== undefined) {
      updateData.phoneNumber = validatedData.phoneNumber?.trim() || null
    }

    // Mettre à jour la demande
    const updatedRequest = await prisma.carpoolRequest.update({
      where: { id: requestId },
      data: updateData,
      include: carpoolRequestInclude,
    })

    return updatedRequest
  },
  { operationName: 'UpdateCarpoolRequest' }
)
