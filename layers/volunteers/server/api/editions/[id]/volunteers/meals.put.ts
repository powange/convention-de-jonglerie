import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'
import { isVolunteerEligibleForMeal } from '#server/utils/volunteer-meals'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      status: 403,
      message: 'Droits insuffisants pour modifier ces données',
    })

  const body = await readBody(event)

  // Valider le body
  if (!body.meals || !Array.isArray(body.meals)) {
    throw createError({
      status: 400,
      message: 'Format de données invalide',
    })
  }

  // Valider le format des handoutItemIds si fourni
  for (const meal of body.meals) {
    if (meal.handoutItemIds !== undefined && !Array.isArray(meal.handoutItemIds)) {
      throw createError({
        status: 400,
        message: 'handoutItemIds doit être un tableau',
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
        status: 400,
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
          eventId: editionId,
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

      await Promise.all(volunteerSelections)

      // Étape 1bis (port artists) : sélections des artistes éligibles déléguées au binding (le layer
      // ne connaît pas la notion d'artiste).
      await useVolunteerPorts().artists.addEligibleMealSelections({
        editionId,
        mealId: meal.id,
        date: mealData.date,
        mealType: mealData.mealType,
      })

      console.log(
        `[Meals] Repas ${meal.id} ajouté à ${eligibleVolunteers.length}/${acceptedVolunteers.length} bénévoles éligibles`
      )
    } else {
      // Repas désactivé : supprimer toutes les sélections
      console.log(`[Meals] Désactivation du repas ${meal.id} pour l'édition ${editionId}`)

      const volunteerResult = await prisma.volunteerMealSelection.deleteMany({
        where: { mealId: meal.id },
      })

      // Étape 1bis (port artists) : suppression des sélections artistes déléguée au binding.
      await useVolunteerPorts().artists.removeMealSelections(meal.id)

      console.log(`[Meals] Repas ${meal.id} supprimé de ${volunteerResult.count} bénévoles`)
    }
  })

  await Promise.all(syncPromises)

  // Gérer les articles à remettre pour chaque repas
  const handoutItemsPromises = body.meals.map(async (meal: any) => {
    // Ignorer si handoutItemIds n'est pas fourni
    if (meal.handoutItemIds === undefined) {
      return
    }

    if (!meal.id) {
      throw createError({
        status: 400,
        message: 'ID de repas manquant',
      })
    }

    // Supprimer toutes les associations existantes
    await prisma.volunteerMealHandoutItem.deleteMany({
      where: { mealId: meal.id },
    })

    // Créer les nouvelles associations
    if (meal.handoutItemIds.length > 0) {
      await prisma.volunteerMealHandoutItem.createMany({
        data: meal.handoutItemIds.map((itemId: number) => ({
          mealId: meal.id,
          handoutItemId: itemId,
        })),
      })
    }

    console.log(
      `[Meals] Articles à remettre mis à jour pour le repas ${meal.id}: ${meal.handoutItemIds.length} articles`
    )
  })

  await Promise.all(handoutItemsPromises)

  // Récupérer tous les repas mis à jour avec les liaisons d'articles à remettre (donnée propre)
  const updatedMeals = await prisma.volunteerMeal.findMany({
    where: { editionId },
    include: {
      handoutItems: true,
    },
    orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
  })

  // Étape 1bis : détail du catalogue (TicketingHandoutItem) résolu via le port ticketing puis
  // ré-attaché (forme `handoutItems[].handoutItem` conservée → front inchangé).
  const handoutItemIds = [
    ...new Set(updatedMeals.flatMap((m) => m.handoutItems.map((h) => h.handoutItemId))),
  ]
  const handoutCatalog = await useVolunteerPorts().ticketing.getHandoutItems(handoutItemIds)
  const mealsWithHandouts = updatedMeals.map((m) => ({
    ...m,
    handoutItems: m.handoutItems.map((h) => ({
      ...h,
      handoutItem: handoutCatalog[h.handoutItemId] ?? null,
    })),
  }))

  return createSuccessResponse({ meals: mealsWithHandouts })
}, 'UpdateVolunteerMeals')
