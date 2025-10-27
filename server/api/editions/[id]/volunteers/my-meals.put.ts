import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  const body = await readBody(event)

  // Valider le body
  if (!body.selections || !Array.isArray(body.selections)) {
    throw createError({
      statusCode: 400,
      message: 'Format de données invalide',
    })
  }

  try {
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
        statusCode: 404,
        message: "Vous n'êtes pas bénévole pour cette édition",
      })
    }

    if (volunteer.status !== 'ACCEPTED') {
      throw createError({
        statusCode: 403,
        message: "Votre candidature n'a pas encore été acceptée",
      })
    }

    // Mettre à jour les sélections
    const updatePromises = body.selections.map((selection: any) => {
      if (!selection.selectionId) {
        throw createError({
          statusCode: 400,
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
      phase: selection.meal.phase,
      selectionId: selection.id,
      accepted: selection.accepted,
    }))

    return {
      success: true,
      meals: mealsWithSelections,
    }
  } catch (error: unknown) {
    console.error('Failed to update volunteer meal selections:', error)

    // Propager les erreurs HTTP existantes
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la mise à jour de vos repas',
    })
  }
})
