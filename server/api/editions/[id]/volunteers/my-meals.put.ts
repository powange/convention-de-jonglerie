import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

export default wrapApiHandler(async (event) => {
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

  // Récupérer le bénévole
  const volunteer = await prisma.editionVolunteerApplication.findUnique({
    where: {
      editionId_userId: {
        editionId,
        userId: user.id,
      },
    },
    select: {
      id: true,
      status: true,
    },
  })

  if (!volunteer) {
    throw createError({
      status: 404,
      message: "Vous n'êtes pas bénévole pour cette édition",
    })
  }

  if (volunteer.status !== 'ACCEPTED') {
    throw createError({
      status: 403,
      message: "Votre candidature n'a pas encore été acceptée",
    })
  }

  // Mettre à jour les sélections
  const updatePromises = body.selections.map((selection: any) => {
    if (!selection.selectionId) {
      throw createError({
        status: 400,
        message: 'ID de sélection manquant',
      })
    }

    return prisma.volunteerMealSelection.update({
      where: {
        id: selection.selectionId,
        volunteerId: volunteer.id, // Sécurité : vérifier que la sélection appartient à ce bénévole
      },
      data: {
        accepted: selection.accepted ?? undefined,
      },
    })
  })

  await Promise.all(updatePromises)

  // Récupérer toutes les sélections mises à jour avec les repas associés
  const updatedSelections = await prisma.volunteerMealSelection.findMany({
    where: {
      volunteerId: volunteer.id,
    },
    include: {
      meal: true,
    },
    orderBy: [{ meal: { date: 'asc' } }, { meal: { mealType: 'asc' } }],
  })

  // Formater le résultat
  const mealsWithSelections = updatedSelections.map((selection) => ({
    id: selection.meal.id,
    date: selection.meal.date,
    mealType: selection.meal.mealType,
    phases: selection.meal.phases,
    selectionId: selection.id,
    accepted: selection.accepted,
  }))

  return {
    success: true,
    meals: mealsWithSelections,
  }
}, 'UpdateMyVolunteerMeals')
