import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import {
  isVolunteerEligibleForMeal,
  isArtistEligibleForMeal,
} from '@@/server/utils/volunteer-meals'

export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour modifier ces données',
    })

  const body = await readBody(event)

  // Valider le body
  if (!body.meals || !Array.isArray(body.meals)) {
    throw createError({
      statusCode: 400,
      message: 'Format de données invalide',
    })
  }

  // Valider le format des returnableItemIds si fourni
  for (const meal of body.meals) {
    if (meal.returnableItemIds !== undefined && !Array.isArray(meal.returnableItemIds)) {
      throw createError({
        statusCode: 400,
        message: 'returnableItemIds doit être un tableau',
      })
    }
  }

  // Récupérer l'état actuel des repas avant mise à jour
    const mealIds = body.meals.map((meal: any) => meal.id).filter(Boolean)
    const currentMeals = await prisma.volunteerMeal.findMany({
      where: {
        id: { in: mealIds },
        editionId,
      },
      select: {
        id: true,
        enabled: true,
      },
    })

    // Créer un Map pour un accès rapide
    const currentMealsMap = new Map(currentMeals.map((m) => [m.id, m.enabled]))

    // Mettre à jour les repas fournis
    const updatePromises = body.meals.map((meal: any) => {
      if (!meal.id) {
        throw createError({
          statusCode: 400,
          message: 'ID de repas manquant',
        })
      }

      return prisma.volunteerMeal.update({
        where: {
          id: meal.id,
          editionId, // Sécurité : vérifier que le repas appartient à cette édition
        },
        data: {
          enabled: meal.enabled ?? undefined,
          phases: meal.phases ?? undefined,
        },
      })
    })

    await Promise.all(updatePromises)

    // Synchroniser les sélections de repas pour les bénévoles et artistes
    const syncPromises = body.meals.map(async (meal: any) => {
      const wasEnabled = currentMealsMap.get(meal.id)
      const isNowEnabled = meal.enabled

      // Ignorer si l'état enabled n'a pas changé
      if (meal.enabled === undefined || wasEnabled === isNowEnabled) {
        return
      }

      if (isNowEnabled) {
        // Repas activé : ajouter aux bénévoles et artistes éligibles
        console.log(`[Meals] Activation du repas ${meal.id} pour l'édition ${editionId}`)

        // Récupérer les informations complètes du repas
        const mealData = await prisma.volunteerMeal.findUnique({
          where: { id: meal.id },
          select: {
            date: true,
            mealType: true,
            phases: true,
          },
        })

        if (!mealData) {
          console.error(`[Meals] Repas ${meal.id} introuvable`)
          return
        }

        // Récupérer tous les bénévoles acceptés avec leurs données d'éligibilité
        const acceptedVolunteers = await prisma.editionVolunteerApplication.findMany({
          where: {
            editionId,
            status: 'ACCEPTED',
          },
          select: {
            id: true,
            setupAvailability: true,
            teardownAvailability: true,
            eventAvailability: true,
            arrivalDateTime: true,
            departureDateTime: true,
          },
        })

        // Récupérer tous les artistes avec leurs données d'éligibilité
        const artists = await prisma.editionArtist.findMany({
          where: { editionId },
          select: {
            id: true,
            arrivalDateTime: true,
            departureDateTime: true,
          },
        })

        // S'assurer que phases est un tableau de strings
        const phases = Array.isArray(mealData.phases) ? (mealData.phases as string[]) : []

        // Filtrer les bénévoles éligibles selon les règles
        const eligibleVolunteers = acceptedVolunteers.filter((volunteer) =>
          isVolunteerEligibleForMeal(
            {
              date: mealData.date,
              mealType: mealData.mealType,
              phases,
            },
            volunteer
          )
        )

        // Filtrer les artistes éligibles selon les règles
        const eligibleArtists = artists.filter((artist) =>
          isArtistEligibleForMeal(
            {
              date: mealData.date,
              mealType: mealData.mealType,
            },
            artist
          )
        )

        // Créer les sélections de repas pour les bénévoles éligibles (si pas déjà existantes)
        const volunteerSelections = eligibleVolunteers.map((volunteer) =>
          prisma.volunteerMealSelection.upsert({
            where: {
              volunteerId_mealId: {
                volunteerId: volunteer.id,
                mealId: meal.id,
              },
            },
            create: {
              volunteerId: volunteer.id,
              mealId: meal.id,
              selected: true,
            },
            update: {
              selected: true,
            },
          })
        )

        // Créer les sélections de repas pour les artistes éligibles (si pas déjà existantes)
        const artistSelections = eligibleArtists.map((artist) =>
          prisma.artistMealSelection.upsert({
            where: {
              artistId_mealId: {
                artistId: artist.id,
                mealId: meal.id,
              },
            },
            create: {
              artistId: artist.id,
              mealId: meal.id,
              selected: true,
            },
            update: {
              selected: true,
            },
          })
        )

        await Promise.all([...volunteerSelections, ...artistSelections])
        console.log(
          `[Meals] Repas ${meal.id} ajouté à ${eligibleVolunteers.length}/${acceptedVolunteers.length} bénévoles éligibles et ${eligibleArtists.length}/${artists.length} artistes éligibles`
        )
      } else {
        // Repas désactivé : supprimer toutes les sélections
        console.log(`[Meals] Désactivation du repas ${meal.id} pour l'édition ${editionId}`)

        const deleteVolunteers = prisma.volunteerMealSelection.deleteMany({
          where: { mealId: meal.id },
        })

        const deleteArtists = prisma.artistMealSelection.deleteMany({
          where: { mealId: meal.id },
        })

        const [volunteerResult, artistResult] = await Promise.all([deleteVolunteers, deleteArtists])

        console.log(
          `[Meals] Repas ${meal.id} supprimé de ${volunteerResult.count} bénévoles et ${artistResult.count} artistes`
        )
      }
    })

    await Promise.all(syncPromises)

    // Gérer les articles à restituer pour chaque repas
    const returnableItemsPromises = body.meals.map(async (meal: any) => {
      // Ignorer si returnableItemIds n'est pas fourni
      if (meal.returnableItemIds === undefined) {
        return
      }

      if (!meal.id) {
        throw createError({
          statusCode: 400,
          message: 'ID de repas manquant',
        })
      }

      // Supprimer toutes les associations existantes
      await prisma.volunteerMealReturnableItem.deleteMany({
        where: { mealId: meal.id },
      })

      // Créer les nouvelles associations
      if (meal.returnableItemIds.length > 0) {
        await prisma.volunteerMealReturnableItem.createMany({
          data: meal.returnableItemIds.map((itemId: number) => ({
            mealId: meal.id,
            returnableItemId: itemId,
          })),
        })
      }

      console.log(
        `[Meals] Articles à restituer mis à jour pour le repas ${meal.id}: ${meal.returnableItemIds.length} articles`
      )
    })

    await Promise.all(returnableItemsPromises)

    // Récupérer tous les repas mis à jour avec les articles à restituer
    const updatedMeals = await prisma.volunteerMeal.findMany({
      where: { editionId },
      include: {
        returnableItems: {
          include: {
            returnableItem: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    })

  return {
    success: true,
    meals: updatedMeals,
  }
}, 'UpdateVolunteerMeals')
