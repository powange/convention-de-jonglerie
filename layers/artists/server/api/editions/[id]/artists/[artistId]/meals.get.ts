import { useArtistsPorts } from '#server/artists/ports/registry'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageArtists,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'
import {
  getAvailableMealsOnArrival,
  getAvailableMealsOnDeparture,
} from '#server/utils/volunteer-meals'
import { lirePresenceArtiste } from '~~/shared/utils/presence-artiste'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)
    const artistId = validateResourceId(event, 'artistId', 'artiste')
    // Vérifier que l'utilisateur a les permissions pour éditer cette édition (util core via #server)
    const edition = await getEditionWithPermissions(editionId, { userId: user.id })

    if (!edition) {
      throw createError({ status: 404, message: 'Édition introuvable' })
    }

    if (!canManageArtists(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas autorisé à gérer les artistes de cette édition",
      })
    }

    // Récupérer l'artiste avec ses dates d'arrivée et de départ
    const artist = await prisma.editionArtist.findUnique({
      where: {
        id: artistId,
        editionId,
      },
    })

    if (!artist) {
      throw createError({
        status: 404,
        message: 'Artiste introuvable',
      })
    }

    // Récupérer le catalogue des repas activés via le port (le layer ne lit pas VolunteerMeal)
    const allMeals = await useArtistsPorts().meals.getEnabledMeals(editionId)

    // Les dates de présence sont lues une fois, dans le fuseau de l'édition : une arrivée à
    // 23 h 30 appartient au jour qu'il est sur place, et découper ailleurs la ferait basculer au
    // lendemain. C'est déjà la règle de l'affichage côté artiste.
    const arrivee = lirePresenceArtiste(artist.arrivalDateTime, edition.timezone)
    const depart = lirePresenceArtiste(artist.departureDateTime, edition.timezone)

    // Filtrer les repas selon les dates de présence de l'artiste (si renseignées)
    const filteredMeals = allMeals.filter((meal) => {
      // Si les dates ne sont pas renseignées, afficher tous les repas
      if (!arrivee && !depart) {
        return true
      }

      const mealDate = new Date(meal.date)
      mealDate.setUTCHours(0, 0, 0, 0)

      // Un artiste porte une vraie date avec une heure, là où un bénévole porte le texte
      // `AAAA-MM-JJ_moment`. Ce filtre avait été recopié du second sans cette différence, et
      // appelait donc `.split` sur un objet Date : 500 pour tout artiste ayant des dates.
      if (arrivee) {
        const arrivalDate = new Date(arrivee.journee)
        arrivalDate.setUTCHours(0, 0, 0, 0)

        if (mealDate < arrivalDate) return false

        // Si c'est le jour d'arrivée, vérifier l'heure
        if (mealDate.getTime() === arrivalDate.getTime()) {
          // Le tableau est élargi en `string[]` plutôt que de forcer `meal.mealType` en
          // `VolunteerMealType` : le catalogue des repas vient du port et n'est typé que
          // `string`. Élargir est sûr ; affirmer l'inverse serait une supposition.
          const availableMeals: string[] = getAvailableMealsOnArrival(arrivee.moment)
          if (!availableMeals.includes(meal.mealType)) return false
        }
      }

      if (depart) {
        const departureDate = new Date(depart.journee)
        departureDate.setUTCHours(0, 0, 0, 0)

        if (mealDate > departureDate) return false

        // Si c'est le jour de départ, vérifier l'heure
        if (mealDate.getTime() === departureDate.getTime()) {
          const availableMeals: string[] = getAvailableMealsOnDeparture(depart.moment)
          if (!availableMeals.includes(meal.mealType)) return false
        }
      }

      return true
    })

    // Récupérer TOUTES les sélections existantes de l'artiste
    const allExistingSelections = await prisma.artistMealSelection.findMany({
      where: {
        artistId: artist.id,
      },
    })

    // Identifier les IDs de repas éligibles
    const eligibleMealIds = new Set(filteredMeals.map((m) => m.id))

    // Identifier les sélections à supprimer (repas non éligibles)
    const selectionsToDelete = allExistingSelections.filter(
      (selection) => !eligibleMealIds.has(selection.mealId)
    )

    // Supprimer les sélections non éligibles
    if (selectionsToDelete.length > 0) {
      await prisma.artistMealSelection.deleteMany({
        where: {
          id: {
            in: selectionsToDelete.map((s) => s.id),
          },
        },
      })
    }

    // Filtrer les sélections existantes pour ne garder que celles éligibles
    const existingSelections = allExistingSelections.filter((selection) =>
      eligibleMealIds.has(selection.mealId)
    )

    // Créer un map des sélections existantes
    const selectionsMap = new Map(existingSelections.map((s) => [s.mealId, s]))

    // Créer les sélections manquantes avec accepted=true par défaut
    const selectionsToCreate = filteredMeals
      .filter((meal) => !selectionsMap.has(meal.id))
      .map((meal) => ({
        artistId: artist.id,
        mealId: meal.id,
        accepted: true,
      }))

    if (selectionsToCreate.length > 0) {
      await prisma.artistMealSelection.createMany({
        data: selectionsToCreate,
      })

      // Récupérer les nouvelles sélections
      const newSelections = await prisma.artistMealSelection.findMany({
        where: {
          artistId: artist.id,
          mealId: {
            in: selectionsToCreate.map((s) => s.mealId),
          },
        },
      })

      // Ajouter les nouvelles sélections au map
      newSelections.forEach((s) => selectionsMap.set(s.mealId, s))
    }

    // Construire le résultat avec les repas et leurs sélections
    const mealsWithSelections = filteredMeals.map((meal) => {
      const selection = selectionsMap.get(meal.id)
      return {
        id: meal.id,
        date: meal.date,
        mealType: meal.mealType,
        phases: meal.phases,
        selectionId: selection?.id,
        accepted: selection?.accepted ?? true,
        afterShow: selection?.afterShow ?? false,
      }
    })

    return createSuccessResponse({ meals: mealsWithSelections })
  },
  { operationName: 'GetArtistMeals' }
)
