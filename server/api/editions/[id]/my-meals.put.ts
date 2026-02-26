import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const body = await readBody(event)

    // Valider le body
    if (!body.selections || !Array.isArray(body.selections)) {
      throw createError({
        status: 400,
        message: 'Format de données invalide',
      })
    }

    if (body.selections.length > 50) {
      throw createError({
        status: 400,
        message: 'Trop de sélections',
      })
    }

    for (const selection of body.selections) {
      if (typeof selection.selectionId !== 'number' || typeof selection.afterShow !== 'boolean') {
        throw createError({
          status: 400,
          message: 'Format de données invalide',
        })
      }
    }

    // Récupérer l'artiste de l'utilisateur pour cette édition
    const artist = await prisma.editionArtist.findUnique({
      where: {
        editionId_userId: {
          editionId,
          userId: user.id,
        },
      },
    })

    if (!artist) {
      throw createError({
        status: 404,
        message: "Vous n'êtes pas artiste pour cette édition",
      })
    }

    // Mettre à jour uniquement le champ afterShow des sélections (en transaction)
    await prisma.$transaction(
      body.selections.map((selection: { selectionId: number; afterShow: boolean }) =>
        prisma.artistMealSelection.update({
          where: {
            id: selection.selectionId,
            artistId: artist.id, // Sécurité : vérifier que la sélection appartient à cet artiste
          },
          data: {
            afterShow: selection.afterShow,
          },
        })
      )
    )

    // Récupérer les sélections mises à jour
    const updatedSelections = await prisma.artistMealSelection.findMany({
      where: {
        artistId: artist.id,
        accepted: true,
      },
      select: {
        id: true,
        afterShow: true,
        meal: {
          select: {
            id: true,
            date: true,
            mealType: true,
          },
        },
      },
      orderBy: {
        meal: { date: 'asc' },
      },
    })

    return createSuccessResponse({
      mealSelections: updatedSelections.map((ms) => ({
        id: ms.id,
        afterShow: ms.afterShow,
        meal: {
          id: ms.meal.id,
          date: ms.meal.date,
          mealType: ms.meal.mealType,
        },
      })),
    })
  },
  { operationName: 'UpdateMyMeals' }
)
