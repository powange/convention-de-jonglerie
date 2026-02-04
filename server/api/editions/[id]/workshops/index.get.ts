import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const editionId = validateEditionId(event)

    // Récupérer l'utilisateur connecté (optionnel)
    const session = await getUserSession(event)
    const userId = session?.user?.id

    // Vérifier que l'édition existe et que les workshops sont activés
    const edition = await fetchResourceOrFail(prisma.edition, editionId, {
      select: { workshopsEnabled: true },
      errorMessage: 'Édition non trouvée',
    })

    if (!edition.workshopsEnabled) {
      throw createError({
        status: 403,
        message: 'Les workshops ne sont pas activés pour cette édition',
      })
    }

    // Récupérer les workshops avec leurs créateurs, lieux et favoris
    const workshops = await prisma.workshop.findMany({
      where: { editionId },
      include: {
        creator: {
          select: {
            id: true,
            pseudo: true,
            profilePicture: true,
            emailHash: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        favorites: userId
          ? {
              where: { userId },
              select: { id: true },
            }
          : false,
      },
      orderBy: { startDateTime: 'asc' },
    })

    // Transformer pour ajouter isFavorite
    const transformedWorkshops = workshops.map((workshop) => {
      const { favorites, ...workshopWithoutFavorites } = workshop
      return {
        ...workshopWithoutFavorites,
        isFavorite: userId ? favorites.length > 0 : false,
      }
    })

    return transformedWorkshops
  },
  { operationName: 'GetEditionWorkshops' }
)
