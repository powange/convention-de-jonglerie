import { wrapApiHandler } from '#server/utils/api-helpers'

/**
 * Liste tous les appels à spectacles ouverts sur toutes les éditions publiées
 * Accessible par tout le monde (pas besoin d'authentification)
 * Utilisé pour la page centralisée des candidatures artistes
 */
export default wrapApiHandler(
  async () => {
    // Récupérer tous les appels à spectacles publics
    // sur des éditions publiées et dont la date de fin n'est pas passée
    const now = new Date()

    const showCalls = await prisma.editionShowCall.findMany({
      where: {
        visibility: 'PUBLIC',
        edition: {
          status: 'PUBLISHED',
          endDate: {
            gte: now,
          },
        },
      },
      select: {
        id: true,
        name: true,
        visibility: true,
        mode: true,
        externalUrl: true,
        description: true,
        deadline: true,
        askPortfolioUrl: true,
        askVideoUrl: true,
        askTechnicalNeeds: true,
        askAccommodation: true,
        edition: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            city: true,
            country: true,
            imageUrl: true,
            convention: {
              select: {
                id: true,
                name: true,
                logo: true,
              },
            },
          },
        },
      },
      orderBy: [
        { deadline: 'asc' }, // Par date limite croissante
        { edition: { startDate: 'asc' } }, // Puis par date de début d'édition
      ],
    })

    return {
      showCalls,
      count: showCalls.length,
    }
  },
  { operationName: 'GetAllOpenShowCalls' }
)
