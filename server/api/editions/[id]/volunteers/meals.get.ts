import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à ces données',
    })

  try {
    // Récupérer l'édition pour obtenir les dates
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: {
        startDate: true,
        endDate: true,
        volunteersSetupStartDate: true,
        volunteersTeardownEndDate: true,
      },
    })

    if (!edition) {
      throw createError({ statusCode: 404, message: 'Edition non trouvée' })
    }

    // Déterminer la période complète (montage -> démontage)
    const startDate = edition.volunteersSetupStartDate
      ? new Date(edition.volunteersSetupStartDate)
      : new Date(edition.startDate)
    const endDate = edition.volunteersTeardownEndDate
      ? new Date(edition.volunteersTeardownEndDate)
      : new Date(edition.endDate)

    // Vérifier si des repas existent déjà
    const existingMeals = await prisma.volunteerMeal.findMany({
      where: { editionId },
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    })

    // Si des repas existent, les retourner directement
    if (existingMeals.length > 0) {
      return {
        success: true,
        meals: existingMeals,
      }
    }

    // Sinon, générer automatiquement les repas
    const mealsToCreate: any[] = []
    const currentDate = new Date(startDate)
    currentDate.setUTCHours(0, 0, 0, 0)

    const editionStart = new Date(edition.startDate)
    editionStart.setUTCHours(0, 0, 0, 0)
    const editionEnd = new Date(edition.endDate)
    editionEnd.setUTCHours(0, 0, 0, 0)

    while (currentDate <= endDate) {
      const currentDateStr = currentDate.toISOString()

      // Déterminer la phase (SETUP, EVENT, TEARDOWN)
      let phase: 'SETUP' | 'EVENT' | 'TEARDOWN'
      if (currentDate < editionStart) {
        phase = 'SETUP'
      } else if (currentDate > editionEnd) {
        phase = 'TEARDOWN'
      } else {
        phase = 'EVENT'
      }

      // Créer les 3 repas pour cette journée
      mealsToCreate.push({
        editionId,
        date: currentDateStr,
        mealType: 'BREAKFAST',
        enabled: true,
        phase,
      })

      mealsToCreate.push({
        editionId,
        date: currentDateStr,
        mealType: 'LUNCH',
        enabled: true,
        phase,
      })

      mealsToCreate.push({
        editionId,
        date: currentDateStr,
        mealType: 'DINNER',
        enabled: true,
        phase,
      })

      // Passer au jour suivant
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Créer tous les repas en base
    await prisma.volunteerMeal.createMany({
      data: mealsToCreate,
    })

    // Récupérer les repas créés
    const createdMeals = await prisma.volunteerMeal.findMany({
      where: { editionId },
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    })

    return {
      success: true,
      meals: createdMeals,
    }
  } catch (error: unknown) {
    console.error('Failed to fetch volunteer meals:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des repas bénévoles',
    })
  }
})
