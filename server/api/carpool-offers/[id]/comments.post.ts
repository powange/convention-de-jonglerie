import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { sanitizeString, validateResourceId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const carpoolOfferId = validateResourceId(event, 'id', 'offre')
    const body = await readBody(event)

    // Validation des données
    const content = sanitizeString(body.content)
    if (!content) {
      throw createError({
        statusCode: 400,
        message: 'Le commentaire ne peut pas être vide',
      })
    }

    // Vérifier que l'offre de covoiturage existe
    await fetchResourceOrFail(prisma.carpoolOffer, carpoolOfferId, {
      errorMessage: 'Offre de covoiturage non trouvée',
    })

    // Créer le commentaire
    const comment = await prisma.carpoolComment.create({
      data: {
        carpoolOfferId,
        userId: user.id,
        content,
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
          },
        },
      },
    })

    return comment
  },
  { operationName: 'CreateCarpoolOfferComment' }
)
