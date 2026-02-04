import { applyCustomName } from '#server/utils/editions/ticketing/tiers'

/**
 * Route publique pour récupérer les tarifs actifs d'une édition
 * Utilisée pour le SEO (Schema.org)
 */
export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

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
