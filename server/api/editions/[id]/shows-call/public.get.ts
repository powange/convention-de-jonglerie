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

    // Récupérer les appels publics ou fermés avec description (exclure les PRIVATE)
    const showCalls = await prisma.editionShowCall.findMany({
      where: {
        editionId,
        OR: [{ visibility: 'PUBLIC' }, { visibility: 'CLOSED', description: { not: null } }],
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
      },
      orderBy: [
        { visibility: 'asc' }, // CLOSED < PRIVATE < PUBLIC — PUBLIC en dernier alphabétiquement mais on trie ensuite
        { deadline: 'asc' },
        { name: 'asc' },
      ],
    })

    // Trier : PUBLIC en premier, puis CLOSED
    const sorted = showCalls.sort((a, b) => {
      if (a.visibility === 'PUBLIC' && b.visibility !== 'PUBLIC') return -1
      if (a.visibility !== 'PUBLIC' && b.visibility === 'PUBLIC') return 1
      return 0
    })

    return {
      showCalls: sorted,
      hasOpenCalls: sorted.some((sc) => sc.visibility === 'PUBLIC'),
    }
  },
  { operationName: 'GetPublicShowCalls' }
)
