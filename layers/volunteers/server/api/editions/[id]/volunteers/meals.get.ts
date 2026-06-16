import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

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
    // Étape 0bis : dates de l'événement (Event) + dates de montage/démontage (EventVolunteerSettings)
    const eventRecord = await fetchResourceOrFail(prisma.event, editionId, {
      errorMessage: 'Édition non trouvée',
      select: {
        startDate: true,
        endDate: true,
        volunteerSettings: { select: { setupStartDate: true, teardownEndDate: true } },
      },
    })
    const eventStartDate = eventRecord.startDate ?? new Date()
    const eventEndDate = eventRecord.endDate ?? eventStartDate
    const s = eventRecord.volunteerSettings

    // Déterminer la période complète (montage -> démontage)
    const periodStart = s?.setupStartDate ? new Date(s.setupStartDate) : new Date(eventStartDate)
    periodStart.setUTCHours(0, 0, 0, 0)

    const periodEnd = s?.teardownEndDate ? new Date(s.teardownEndDate) : new Date(eventEndDate)
    periodEnd.setUTCHours(0, 0, 0, 0)

    const editionStart = new Date(eventStartDate)
    editionStart.setUTCHours(0, 0, 0, 0)
    const editionEnd = new Date(eventEndDate)
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
        // Étape 1bis : on ne lit que la liaison repas↔article (donnée propre) ; le détail du
        // catalogue (TicketingHandoutItem) est résolu via le port ticketing.
        handoutItems: true,
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

    // Étape 1bis : résoudre le catalogue d'articles à remettre via le port ticketing, puis le
    // ré-attacher à chaque liaison (forme `handoutItems[].handoutItem` conservée → front inchangé).
    const attachHandoutItems = async <T extends { handoutItems: { handoutItemId: number }[] }>(
      list: T[]
    ) => {
      const ids = [...new Set(list.flatMap((m) => m.handoutItems.map((h) => h.handoutItemId)))]
      const catalog = await useVolunteerPorts().ticketing.getHandoutItems(ids)
      return list.map((m) => ({
        ...m,
        handoutItems: m.handoutItems.map((h) => ({
          ...h,
          handoutItem: catalog[h.handoutItemId] ?? null,
        })),
      }))
    }

    // Si rien n'a changé, retourner les repas existants directement
    if (mealsToDeleteIds.length === 0 && mealsToCreate.length === 0) {
      return createSuccessResponse({ meals: await attachHandoutItems(existingMeals) })
    }

    // Sinon, récupérer la liste à jour
    const updatedMeals = await prisma.volunteerMeal.findMany({
      where: { editionId },
      include: {
        // Étape 1bis : on ne lit que la liaison repas↔article (donnée propre) ; le détail du
        // catalogue (TicketingHandoutItem) est résolu via le port ticketing.
        handoutItems: true,
      },
      orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
    })

    return createSuccessResponse({ meals: await attachHandoutItems(updatedMeals) })
  },
  { operationName: 'GetVolunteerMeals' }
)
