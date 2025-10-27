import { requireAuth } from '@@/server/utils/auth-utils'
import { canEditEdition } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import {
  getAvailableMealsOnArrival,
  getAvailableMealsOnDeparture,
} from '@@/server/utils/volunteer-meals'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const artistId = parseInt(getRouterParam(event, 'artistId') || '0')

  if (!editionId || !artistId) {
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })
  }

  try {
    // Vérifier que l'utilisateur a les permissions pour éditer cette édition
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      include: {
        convention: {
          include: {
            collaborators: true,
          },
        },
        collaboratorPermissions: {
          include: {
            collaborator: true,
          },
        },
      },
    })

    if (!edition) {
      throw createError({ statusCode: 404, message: 'Édition introuvable' })
    }

    if (!canEditEdition(edition, user)) {
      throw createError({
        statusCode: 403,
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
        statusCode: 404,
        message: 'Artiste introuvable',
      })
    }

    // Récupérer tous les repas activés pour l'édition
    const allMeals = await prisma.volunteerMeal.findMany({
      where: {
        editionId,
        enabled: true,
      },
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    })

    // Filtrer les repas selon les dates de présence de l'artiste (si renseignées)
    const filteredMeals = allMeals.filter((meal) => {
      // Si les dates ne sont pas renseignées, afficher tous les repas
      if (!artist.arrivalDateTime && !artist.departureDateTime) {
        return true
      }

      const mealDate = new Date(meal.date)
      mealDate.setUTCHours(0, 0, 0, 0)

      if (artist.arrivalDateTime) {
        // Format: YYYY-MM-DD_timeOfDay
        const [arrivalDatePart, arrivalTimeOfDay] = artist.arrivalDateTime.split('_')
        const arrivalDate = new Date(arrivalDatePart)
        arrivalDate.setUTCHours(0, 0, 0, 0)

        if (mealDate < arrivalDate) return false

        // Si c'est le jour d'arrivée, vérifier l'heure
        if (mealDate.getTime() === arrivalDate.getTime()) {
          const availableMeals = getAvailableMealsOnArrival(arrivalTimeOfDay)
          if (!availableMeals.includes(meal.mealType)) return false
        }
      }

      if (artist.departureDateTime) {
        // Format: YYYY-MM-DD_timeOfDay
        const [departureDatePart, departureTimeOfDay] = artist.departureDateTime.split('_')
        const departureDate = new Date(departureDatePart)
        departureDate.setUTCHours(0, 0, 0, 0)

        if (mealDate > departureDate) return false

        // Si c'est le jour de départ, vérifier l'heure
        if (mealDate.getTime() === departureDate.getTime()) {
          const availableMeals = getAvailableMealsOnDeparture(departureTimeOfDay)
          if (!availableMeals.includes(meal.mealType)) return false
        }
      }

      return true
    })

    // Récupérer les sélections existantes
    const existingSelections = await prisma.artistMealSelection.findMany({
      where: {
        artistId: artist.id,
        mealId: {
          in: filteredMeals.map((m) => m.id),
        },
      },
    })

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
        phase: meal.phase,
        selectionId: selection?.id,
        accepted: selection?.accepted ?? true,
      }
    })

    return {
      success: true,
      meals: mealsWithSelections,
    }
  } catch (error: unknown) {
    console.error('Failed to fetch artist meals:', error)

    // Propager les erreurs HTTP existantes
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des repas',
    })
  }
})
