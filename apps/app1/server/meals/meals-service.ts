// Module « repas » (cœur). Regroupe la logique d'accès aux modèles du schéma meals.prisma
// (VolunteerMeal, VolunteerMealSelection, VolunteerMealHandoutItem). Le module bénévole (layer) ne
// touche plus ces modèles directement : il délègue via le MealsPort, dont le câblage jonglerie
// (server/volunteers/ports/default-binding.ts) appelle ce service.
//
// NB : les sélections artistes (ArtistMealSelection) et la billetterie sont gérées par d'autres
// ports (ArtistsPort, TicketingPort) ; ce service ne traite que la part bénévole + définitions de repas.
import type { MealToggle, MealUpdateInput, MealVolunteerParticipant } from './meals-types'

import {
  isVolunteerEligibleForMeal,
  getAvailableMealsOnArrival,
  getAvailableMealsOnDeparture,
} from '#server/utils/volunteer-meals'

interface VolunteerAvailability {
  setupAvailability: boolean
  eventAvailability: boolean
  teardownAvailability: boolean
  arrivalDateTime: string | null
  departureDateTime: string | null
}

/**
 * Réconcilie le planning des repas d'une édition (montage → démontage) et renvoie les repas avec
 * la liaison d'articles à remettre. (ex-`meals.get.ts`.) Le détail du catalogue handout est résolu
 * en aval par le TicketingPort.
 */
export async function getEditionMealSchedule(editionId: number) {
  const eventRecord = await prisma.event.findUnique({
    where: { id: editionId },
    select: {
      startDate: true,
      endDate: true,
      volunteerSettings: { select: { setupStartDate: true, teardownEndDate: true } },
    },
  })
  if (!eventRecord) {
    throw createError({ status: 404, message: 'Édition non trouvée' })
  }

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

  const existingMeals = await prisma.volunteerMeal.findMany({
    where: { editionId },
    include: { handoutItems: true },
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
      mealsToDeleteIds.push(meal.id)
    }
  }

  if (mealsToDeleteIds.length > 0) {
    await prisma.volunteerMeal.deleteMany({ where: { id: { in: mealsToDeleteIds } } })
  }

  const getPhaseForDate = (dateStr: string): string[] => {
    const date = new Date(dateStr)
    date.setUTCHours(0, 0, 0, 0)
    if (date < editionStart) return ['SETUP']
    if (date > editionEnd) return ['TEARDOWN']
    return ['EVENT']
  }

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
    return existingMeals
  }

  return prisma.volunteerMeal.findMany({
    where: { editionId },
    include: { handoutItems: true },
    orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
  })
}

/**
 * Met à jour la config des repas (enabled/phases), synchronise les sélections **bénévoles** et les
 * liaisons d'articles à remettre. Renvoie les repas à jour (avec liaisons handout) et la liste des
 * bascules d'activation, pour que l'appelant pilote les sélections **artistes** (ArtistsPort).
 * (ex-`meals.put.ts`, hors parties artistes/ticketing déléguées aux autres ports.)
 */
export async function updateEditionMealsConfig(editionId: number, meals: MealUpdateInput[]) {
  const mealIds = meals.map((meal) => meal.id).filter(Boolean)
  const currentMeals = await prisma.volunteerMeal.findMany({
    where: { id: { in: mealIds }, editionId },
    select: { id: true, enabled: true },
  })
  const currentMealsMap = new Map(currentMeals.map((m) => [m.id, m.enabled]))

  await Promise.all(
    meals.map((meal) => {
      if (!meal.id) {
        throw createError({ status: 400, message: 'ID de repas manquant' })
      }
      return prisma.volunteerMeal.update({
        where: { id: meal.id, editionId },
        data: { enabled: meal.enabled ?? undefined, phases: meal.phases ?? undefined },
      })
    })
  )

  const toggles: MealToggle[] = []

  // Synchroniser les sélections bénévoles et collecter les bascules d'activation
  await Promise.all(
    meals.map(async (meal) => {
      const wasEnabled = currentMealsMap.get(meal.id)
      const isNowEnabled = meal.enabled

      if (meal.enabled === undefined || wasEnabled === isNowEnabled) {
        return
      }

      if (isNowEnabled) {
        const mealData = await prisma.volunteerMeal.findUnique({
          where: { id: meal.id },
          select: { date: true, mealType: true, phases: true },
        })
        if (!mealData) {
          console.error(`[Meals] Repas ${meal.id} introuvable`)
          return
        }

        const acceptedVolunteers = await prisma.editionVolunteerApplication.findMany({
          where: { eventId: editionId, status: 'ACCEPTED' },
          select: {
            id: true,
            setupAvailability: true,
            teardownAvailability: true,
            eventAvailability: true,
            arrivalDateTime: true,
            departureDateTime: true,
          },
        })

        const phases = Array.isArray(mealData.phases) ? (mealData.phases as string[]) : []
        const eligibleVolunteers = acceptedVolunteers.filter((volunteer) =>
          isVolunteerEligibleForMeal(
            { date: mealData.date, mealType: mealData.mealType, phases },
            volunteer
          )
        )

        await Promise.all(
          eligibleVolunteers.map((volunteer) =>
            prisma.volunteerMealSelection.upsert({
              where: { volunteerId_mealId: { volunteerId: volunteer.id, mealId: meal.id } },
              create: { volunteerId: volunteer.id, mealId: meal.id, selected: true },
              update: { selected: true },
            })
          )
        )

        toggles.push({
          mealId: meal.id,
          date: mealData.date,
          mealType: mealData.mealType,
          enabled: true,
        })
      } else {
        await prisma.volunteerMealSelection.deleteMany({ where: { mealId: meal.id } })
        toggles.push({ mealId: meal.id, date: new Date(0), mealType: '', enabled: false })
      }
    })
  )

  // Liaisons d'articles à remettre (donnée propre au module repas)
  await Promise.all(
    meals.map(async (meal) => {
      if (meal.handoutItemIds === undefined) return
      if (!meal.id) {
        throw createError({ status: 400, message: 'ID de repas manquant' })
      }
      await prisma.volunteerMealHandoutItem.deleteMany({ where: { mealId: meal.id } })
      if (meal.handoutItemIds.length > 0) {
        await prisma.volunteerMealHandoutItem.createMany({
          data: meal.handoutItemIds.map((itemId) => ({ mealId: meal.id, handoutItemId: itemId })),
        })
      }
    })
  )

  const updatedMeals = await prisma.volunteerMeal.findMany({
    where: { editionId },
    include: { handoutItems: true },
    orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
  })

  return { meals: updatedMeals, toggles }
}

/**
 * Repas éligibles d'un bénévole pour lui-même, avec auto-création des sélections manquantes
 * (accepted=true par défaut). (ex-`my-meals.get.ts`.)
 */
export async function getVolunteerSelfMeals(editionId: number, userId: number) {
  const volunteer = await prisma.editionVolunteerApplication.findUnique({
    where: { eventId_userId: { eventId: editionId, userId } },
    select: {
      id: true,
      status: true,
      setupAvailability: true,
      teardownAvailability: true,
      eventAvailability: true,
      arrivalDateTime: true,
      departureDateTime: true,
    },
  })

  if (!volunteer) {
    throw createError({ status: 404, message: "Vous n'êtes pas bénévole pour cette édition" })
  }
  if (volunteer.status !== 'ACCEPTED') {
    throw createError({ status: 403, message: "Votre candidature n'a pas encore été acceptée" })
  }

  const allMeals = await prisma.volunteerMeal.findMany({
    where: { editionId, enabled: true },
    orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
  })

  const filteredMeals = allMeals.filter((meal) => isEligibleByPhaseAndDates(meal, volunteer))

  const existingSelections = await prisma.volunteerMealSelection.findMany({
    where: { volunteerId: volunteer.id, mealId: { in: filteredMeals.map((m) => m.id) } },
  })
  const selectionsMap = new Map(existingSelections.map((sel) => [sel.mealId, sel]))

  const selectionsToCreate = filteredMeals
    .filter((meal) => !selectionsMap.has(meal.id))
    .map((meal) => ({ volunteerId: volunteer.id, mealId: meal.id, accepted: true }))

  if (selectionsToCreate.length > 0) {
    await prisma.volunteerMealSelection.createMany({ data: selectionsToCreate })
    const newSelections = await prisma.volunteerMealSelection.findMany({
      where: {
        volunteerId: volunteer.id,
        mealId: { in: selectionsToCreate.map((sel) => sel.mealId) },
      },
    })
    newSelections.forEach((sel) => selectionsMap.set(sel.mealId, sel))
  }

  return filteredMeals.map((meal) => {
    const selection = selectionsMap.get(meal.id)
    return {
      id: meal.id,
      date: meal.date,
      mealType: meal.mealType,
      phases: meal.phases,
      selectionId: selection?.id,
      accepted: selection?.accepted ?? true,
    }
  })
}

/** Met à jour les acceptations de repas d'un bénévole pour lui-même. (ex-`my-meals.put.ts`.) */
export async function setVolunteerSelfMealAcceptances(
  editionId: number,
  userId: number,
  selections: Array<{ selectionId: number; accepted?: boolean }>
) {
  const volunteer = await prisma.editionVolunteerApplication.findUnique({
    where: { eventId_userId: { eventId: editionId, userId } },
    select: { id: true, status: true },
  })

  if (!volunteer) {
    throw createError({ status: 404, message: "Vous n'êtes pas bénévole pour cette édition" })
  }
  if (volunteer.status !== 'ACCEPTED') {
    throw createError({ status: 403, message: "Votre candidature n'a pas encore été acceptée" })
  }

  await Promise.all(
    selections.map((selection) => {
      if (!selection.selectionId) {
        throw createError({ status: 400, message: 'ID de sélection manquant' })
      }
      return prisma.volunteerMealSelection.update({
        where: { id: selection.selectionId, volunteerId: volunteer.id },
        data: { accepted: selection.accepted ?? undefined },
      })
    })
  )

  const updatedSelections = await prisma.volunteerMealSelection.findMany({
    where: { volunteerId: volunteer.id },
    include: { meal: true },
    orderBy: [{ meal: { date: 'asc' } }, { meal: { mealType: 'asc' } }],
  })

  return updatedSelections.map((selection) => ({
    id: selection.meal.id,
    date: selection.meal.date,
    mealType: selection.meal.mealType,
    phases: selection.meal.phases,
    selectionId: selection.id,
    accepted: selection.accepted,
  }))
}

/**
 * Repas d'un bénévole donné (vue organisateur) avec sélections + éligibilité, sans auto-création.
 * (ex-`[volunteerId]/meals.get.ts`.)
 */
export async function getVolunteerMeals(editionId: number, volunteerId: number) {
  const volunteer = await prisma.editionVolunteerApplication.findUnique({
    where: { id: volunteerId },
    select: {
      eventId: true,
      setupAvailability: true,
      eventAvailability: true,
      teardownAvailability: true,
      arrivalDateTime: true,
      departureDateTime: true,
    },
  })

  if (!volunteer || volunteer.eventId !== editionId) {
    throw createError({ status: 404, message: 'Bénévole non trouvé pour cette édition' })
  }

  const meals = await prisma.volunteerMeal.findMany({
    where: { editionId, enabled: true },
    include: { mealSelections: { where: { volunteerId } } },
    orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
  })

  return meals.map((meal) => {
    const selection = meal.mealSelections[0]
    const phases = Array.isArray(meal.phases) ? (meal.phases as string[]) : []
    const eligible = isVolunteerEligibleForMeal(
      { date: meal.date, mealType: meal.mealType, phases },
      {
        setupAvailability: volunteer.setupAvailability,
        eventAvailability: volunteer.eventAvailability,
        teardownAvailability: volunteer.teardownAvailability,
        arrivalDateTime: volunteer.arrivalDateTime,
        departureDateTime: volunteer.departureDateTime,
      }
    )
    return {
      id: meal.id,
      date: meal.date,
      mealType: meal.mealType,
      phases,
      selectionId: selection?.id || null,
      accepted: selection?.accepted || false,
      eligible,
    }
  })
}

/** Crée/met à jour les sélections de repas d'un bénévole (vue organisateur). (ex-`[volunteerId]/meals.put.ts`.) */
export async function setVolunteerMeals(
  editionId: number,
  volunteerId: number,
  selections: Array<{ selectionId?: number; mealId?: number; accepted: boolean }>
) {
  const volunteer = await prisma.editionVolunteerApplication.findUnique({
    where: { id: volunteerId },
    select: { eventId: true },
  })

  if (!volunteer || volunteer.eventId !== editionId) {
    throw createError({ status: 404, message: 'Bénévole non trouvé pour cette édition' })
  }

  await Promise.all(
    selections.map(async (selection) => {
      if (!selection.mealId) return
      if (!selection.selectionId) {
        return prisma.volunteerMealSelection.create({
          data: { volunteerId, mealId: selection.mealId, accepted: selection.accepted },
        })
      }
      return prisma.volunteerMealSelection.update({
        where: { id: selection.selectionId, volunteerId },
        data: { accepted: selection.accepted },
      })
    })
  )

  return getVolunteerMeals(editionId, volunteerId)
}

/**
 * Repas (activés) d'une date avec leurs participants **bénévoles** acceptés. (ex-`catering` partie
 * bénévole.) Les participants artistes/billetterie sont fusionnés par l'appelant via leurs ports.
 */
export async function getCateringMealsForDate(editionId: number, targetDate: string) {
  const meals = await prisma.volunteerMeal.findMany({
    where: { editionId, date: new Date(targetDate), enabled: true },
    include: {
      mealSelections: {
        where: { accepted: true },
        include: {
          volunteer: {
            include: {
              user: { select: { nom: true, prenom: true, email: true, phone: true } },
            },
          },
        },
      },
    },
    orderBy: { mealType: 'asc' },
  })

  return meals.map((meal) => ({
    id: meal.id,
    mealType: meal.mealType,
    phases: meal.phases,
    volunteers: meal.mealSelections.map(
      (selection): MealVolunteerParticipant => ({
        nom: selection.volunteer.user.nom,
        prenom: selection.volunteer.user.prenom,
        email: selection.volunteer.user.email,
        phone: selection.volunteer.user.phone,
        dietaryPreference: selection.volunteer.dietaryPreference,
        allergies: selection.volunteer.allergies,
        allergySeverity: selection.volunteer.allergySeverity,
        emergencyContactName: selection.volunteer.emergencyContactName,
        emergencyContactPhone: selection.volunteer.emergencyContactPhone,
      })
    ),
  }))
}

/**
 * Crée automatiquement les sélections de repas d'un bénévole accepté, selon ses disponibilités.
 * (ex-util `volunteer-meals.createVolunteerMealSelections`.)
 */
export async function createVolunteerMealSelections(
  volunteerId: number,
  editionId: number
): Promise<void> {
  const volunteer = await prisma.editionVolunteerApplication.findUnique({
    where: { id: volunteerId },
    select: {
      id: true,
      setupAvailability: true,
      teardownAvailability: true,
      eventAvailability: true,
      arrivalDateTime: true,
      departureDateTime: true,
    },
  })

  if (!volunteer) {
    throw new Error('Bénévole introuvable')
  }

  const allMeals = await prisma.volunteerMeal.findMany({
    where: { editionId, enabled: true },
  })

  const eligibleMeals = allMeals.filter((meal) => {
    const phases = Array.isArray(meal.phases) ? (meal.phases as string[]) : []
    return isVolunteerEligibleForMeal(
      { date: meal.date, mealType: meal.mealType, phases },
      volunteer
    )
  })

  const existingSelections = await prisma.volunteerMealSelection.findMany({
    where: { volunteerId: volunteer.id, mealId: { in: eligibleMeals.map((m) => m.id) } },
  })
  const existingMealIds = new Set(existingSelections.map((sel) => sel.mealId))

  const selectionsToCreate = eligibleMeals
    .filter((meal) => !existingMealIds.has(meal.id))
    .map((meal) => ({ volunteerId: volunteer.id, mealId: meal.id, accepted: true }))

  if (selectionsToCreate.length > 0) {
    await prisma.volunteerMealSelection.createMany({ data: selectionsToCreate })
  }
}

/** Supprime toutes les sélections de repas d'un bénévole. (ex-util.) */
export async function deleteVolunteerMealSelections(volunteerId: number): Promise<void> {
  await prisma.volunteerMealSelection.deleteMany({ where: { volunteerId } })
}

/**
 * Éligibilité d'un repas pour un bénévole par phases + dates (logique inline de l'ex-`my-meals.get`,
 * équivalente à `isVolunteerEligibleForMeal`).
 */
function isEligibleByPhaseAndDates(
  meal: { date: Date; mealType: any; phases: string[] },
  volunteer: VolunteerAvailability
): boolean {
  const hasSetup = meal.phases.includes('SETUP')
  const hasEvent = meal.phases.includes('EVENT')
  const hasTeardown = meal.phases.includes('TEARDOWN')

  const isEligibleForPhases =
    (hasSetup && volunteer.setupAvailability) ||
    (hasEvent && volunteer.eventAvailability) ||
    (hasTeardown && volunteer.teardownAvailability)

  if (!isEligibleForPhases) return false

  const mealDate = new Date(meal.date)
  mealDate.setUTCHours(0, 0, 0, 0)

  if (volunteer.arrivalDateTime) {
    const [arrivalDatePart, arrivalTimeOfDay] = volunteer.arrivalDateTime.split('_')
    const arrivalDate = new Date(arrivalDatePart)
    arrivalDate.setUTCHours(0, 0, 0, 0)
    if (mealDate < arrivalDate) return false
    if (mealDate.getTime() === arrivalDate.getTime()) {
      const availableMeals = getAvailableMealsOnArrival(arrivalTimeOfDay)
      if (!availableMeals.includes(meal.mealType)) return false
    }
  }

  if (volunteer.departureDateTime) {
    const [departureDatePart, departureTimeOfDay] = volunteer.departureDateTime.split('_')
    const departureDate = new Date(departureDatePart)
    departureDate.setUTCHours(0, 0, 0, 0)
    if (mealDate > departureDate) return false
    if (mealDate.getTime() === departureDate.getTime()) {
      const availableMeals = getAvailableMealsOnDeparture(departureTimeOfDay)
      if (!availableMeals.includes(meal.mealType)) return false
    }
  }

  return true
}
