import { wrapApiHandler } from '#server/utils/api-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Liste les appels à spectacles publics d'une édition
 * Accessible par tout le monde (pas besoin d'authentification)
 * Retourne uniquement les appels ouverts ou avec une description
 */
export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    // Récupérer l'édition pour vérifier qu'elle est publiée
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Édition non trouvée',
      })
    }

    // Si l'édition n'est pas publiée, ne pas exposer les appels
    if (edition.status === 'OFFLINE') {
      throw createError({
        status: 404,
        message: 'Édition non disponible',
      })
    }

    // Récupérer tous les appels à spectacles qui sont ouverts ou ont une description
    const showCalls = await prisma.editionShowCall.findMany({
      where: {
        editionId,
        OR: [{ isOpen: true }, { description: { not: null } }],
      },
      select: {
        id: true,
        name: true,
        isOpen: true,
        mode: true,
        externalUrl: true,
        description: true,
        deadline: true,
        askPortfolioUrl: true,
        askVideoUrl: true,
        askTechnicalNeeds: true,
        askAccommodation: true,
      },
      orderBy: [
        { isOpen: 'desc' }, // Ouverts en premier
        { deadline: 'asc' }, // Puis par date limite
        { name: 'asc' },
      ],
    })

    return {
      showCalls,
      hasOpenCalls: showCalls.some((sc) => sc.isOpen),
    }
  },
  { operationName: 'GetPublicShowCalls' }
)
