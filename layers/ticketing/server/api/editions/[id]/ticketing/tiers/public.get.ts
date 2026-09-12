import { wrapApiHandler } from '#server/utils/api-helpers'
import { applyCustomName } from '#server/utils/editions/ticketing/tiers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { editionVisiblePubliquement } from '#server/utils/visibilite-edition'

/**
 * Route publique pour récupérer les tarifs actifs d'une édition
 * Utilisée pour le SEO (Schema.org)
 *
 * Seule route de billetterie accessible sans session, d'où le contrôle de statut ci-dessous :
 * une édition `OFFLINE` est volontairement cachée, et livrait pourtant ses prix à qui connaissait
 * son numéro. Mêmes statuts que ceux qu'accepte la page publique d'une édition, pas plus stricts.
 */
export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { status: true },
    })

    // Même réponse pour « n'existe pas » et « existe mais cachée » : distinguer les deux
    // rendrait la route bavarde sur ce qu'elle est justement censée taire.
    if (!edition || !editionVisiblePubliquement(edition.status)) {
      throw createError({ status: 404, message: 'Edition not found' })
    }

    const tiers = await prisma.ticketingTier.findMany({
      where: {
        editionId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        customName: true,
        description: true,
        price: true,
        position: true,
      },
      orderBy: [{ position: 'asc' }, { price: 'desc' }],
    })

    // Appliquer le nom personnalisé
    return tiers.map(applyCustomName)
  },
  { operationName: 'GET public ticketing tiers' }
)
