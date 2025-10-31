import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionDataOrMealValidation } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const cancelMealSchema = z.object({
  type: z.enum(['volunteer', 'artist', 'participant']),
  id: z.number().int().positive(),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const mealId = parseInt(getRouterParam(event, 'mealId') || '0')

  if (!editionId || !mealId) {
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })
  }

  const allowed = await canAccessEditionDataOrMealValidation(editionId, user.id, event)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour effectuer cette action',
    })
  }

  try {
    const body = await readBody(event)
    const validatedData = cancelMealSchema.parse(body)

    // Vérifier que le repas existe et appartient à cette édition
    const meal = await prisma.volunteerMeal.findFirst({
      where: {
        id: mealId,
        editionId,
      },
    })

    if (!meal) {
      throw createError({
        statusCode: 404,
        message: 'Repas non trouvé',
      })
    }

    // Annuler selon le type
    if (validatedData.type === 'volunteer') {
      // Vérifier que la sélection existe
      const selection = await prisma.volunteerMealSelection.findUnique({
        where: { id: validatedData.id },
        include: {
          volunteer: true,
        },
      })

      if (
        !selection ||
        selection.volunteer.editionId !== editionId ||
        selection.mealId !== mealId
      ) {
        throw createError({
          statusCode: 404,
          message: 'Sélection de repas non trouvée',
        })
      }

      // Annuler la validation
      await prisma.volunteerMealSelection.update({
        where: { id: validatedData.id },
        data: { consumedAt: null },
      })
    } else if (validatedData.type === 'artist') {
      // Vérifier que la sélection existe
      const selection = await prisma.artistMealSelection.findUnique({
        where: { id: validatedData.id },
        include: {
          artist: true,
        },
      })

      if (!selection || selection.artist.editionId !== editionId || selection.mealId !== mealId) {
        throw createError({
          statusCode: 404,
          message: 'Sélection de repas non trouvée',
        })
      }

      // Annuler la validation
      await prisma.artistMealSelection.update({
        where: { id: validatedData.id },
        data: { consumedAt: null },
      })
    } else if (validatedData.type === 'participant') {
      // L'id correspond à un orderItemId
      const orderItem = await prisma.ticketingOrderItem.findUnique({
        where: { id: validatedData.id },
        include: {
          order: true,
        },
      })

      if (!orderItem || orderItem.order.editionId !== editionId) {
        throw createError({
          statusCode: 404,
          message: 'Participant non trouvé',
        })
      }

      // Supprimer la validation de repas
      await prisma.ticketingOrderItemMeal.deleteMany({
        where: {
          orderItemId: validatedData.id,
          mealId,
        },
      })
    }

    return {
      success: true,
    }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      throw createError({
        statusCode: 400,
        message: 'Données invalides',
        data: error.errors,
      })
    }

    if ((error as any).statusCode) {
      throw error
    }

    console.error("Erreur lors de l'annulation du repas:", error)
    throw createError({
      statusCode: 500,
      message: "Erreur lors de l'annulation du repas",
    })
  }
})
