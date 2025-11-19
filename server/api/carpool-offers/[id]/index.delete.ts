import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateResourceId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const offerId = validateResourceId(event, 'id', 'offre')

    // Vérifier que l'offre existe et que l'utilisateur en est le créateur
    const existingOffer = await fetchResourceOrFail(prisma.carpoolOffer, offerId, {
      errorMessage: 'Offre de covoiturage introuvable',
    })

    // Seul le créateur peut supprimer son offre
    if (existingOffer.userId !== user.id) {
      throw createError({
        statusCode: 403,
        message: "Vous n'avez pas les droits pour supprimer cette offre",
      })
    }

    // Supprimer l'offre (les commentaires seront supprimés automatiquement grâce à CASCADE)
    await prisma.carpoolOffer.delete({
      where: { id: offerId },
    })

    return { message: 'Offre de covoiturage supprimée avec succès' }
  },
  { operationName: 'DeleteCarpoolOffer' }
)
