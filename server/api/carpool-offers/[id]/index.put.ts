import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth, requireResourceOwner } from '#server/utils/auth-utils'
import { fetchResourceOrFail, buildUpdateData } from '#server/utils/prisma-helpers'
import { carpoolOfferInclude } from '#server/utils/prisma-select-helpers'
import { validateResourceId } from '#server/utils/validation-helpers'
import { updateCarpoolOfferSchema } from '#server/utils/validation-schemas'

export default wrapApiHandler(
  async (event) => {
    requireAuth(event)
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
    requireResourceOwner(event, existingOffer, {
      errorMessage: "Vous n'avez pas les droits pour modifier cette offre",
    })

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

    return createSuccessResponse(updatedOffer)
  },
  { operationName: 'UpdateCarpoolOffer' }
)
