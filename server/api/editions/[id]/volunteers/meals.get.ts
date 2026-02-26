import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à ces données',
      })
    // Récupérer l'édition pour obtenir les dates
    const edition = await fetchResourceOrFail(prisma.edition, editionId, {
      errorMessage: 'Edition non trouvée',
      select: {
        startDate: true,
        endDate: true,
        volunteersSetupStartDate: true,
        volunteersTeardownEndDate: true,
      },
    })

    // Déterminer la période complète (montage -> démontage)
    const periodStart = edition.volunteersSetupStartDate
      ? new Date(edition.volunteersSetupStartDate)
      : new Date(edition.startDate)
    periodStart.setUTCHours(0, 0, 0, 0)

    const periodEnd = edition.volunteersTeardownEndDate
      ? new Date(edition.volunteersTeardownEndDate)
      : new Date(edition.endDate)
    periodEnd.setUTCHours(0, 0, 0, 0)

    const editionStart = new Date(edition.startDate)
    editionStart.setUTCHours(0, 0, 0, 0)
    const editionEnd = new Date(edition.endDate)
    editionEnd.setUTCHours(0, 0, 0, 0)

    // Construire l'ensemble des dates attendues dans la période
    const expectedDates = new Set<string>()
    const cursor = new Date(periodStart)
    while (cursor <= periodEnd) {
      expectedDates.add(cursor.toISOString().split('T')[0])
      cursor.setDate(cursor.getDate() + 1)
    }

    // Récupérer les repas existants
    const existingMeals = await prisma.volunteerMeal.findMany({
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

    // Identifier les dates existantes et les repas hors période
    const existingDates = new Set<string>()
    const mealsToDeleteIds: number[] = []

    for (const meal of existingMeals) {
      const mealDateStr = new Date(meal.date).toISOString().split('T')[0]
      if (expectedDates.has(mealDateStr)) {
        existingDates.add(mealDateStr)
      } else {
        // Repas hors période → à supprimer
        mealsToDeleteIds.push(meal.id)
      }
    }

    // Supprimer les repas hors période (cascade sur les sélections)
    if (mealsToDeleteIds.length > 0) {
      await prisma.volunteerMeal.deleteMany({
        where: { id: { in: mealsToDeleteIds } },
      })
    }

    // Déterminer la phase par défaut pour une date
    const getPhaseForDate = (dateStr: string): string[] => {
      const date = new Date(dateStr)
      date.setUTCHours(0, 0, 0, 0)
      if (date < editionStart) return ['SETUP']
      if (date > editionEnd) return ['TEARDOWN']
      return ['EVENT']
    }

    // Créer les repas manquants pour les nouvelles dates
    const mealsToCreate: any[] = []
    for (const dateStr of expectedDates) {
      if (!existingDates.has(dateStr)) {
        const phases = getPhaseForDate(dateStr)
        const dateISO = new Date(dateStr).toISOString()

        mealsToCreate.push(
          { editionId, date: dateISO, mealType: 'BREAKFAST', enabled: true, phases },
          { editionId, date: dateISO, mealType: 'LUNCH', enabled: true, phases },
          { editionId, date: dateISO, mealType: 'DINNER', enabled: true, phases }
        )
      }
    }

    if (mealsToCreate.length > 0) {
      await prisma.volunteerMeal.createMany({ data: mealsToCreate })
    }

    // Si rien n'a changé, retourner les repas existants directement
    if (mealsToDeleteIds.length === 0 && mealsToCreate.length === 0) {
      return createSuccessResponse({ meals: existingMeals })
    }

    // Sinon, récupérer la liste à jour
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

    return createSuccessResponse({ meals: updatedMeals })
  },
  { operationName: 'GetVolunteerMeals' }
)
