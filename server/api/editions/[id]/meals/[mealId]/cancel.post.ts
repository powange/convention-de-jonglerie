import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionDataOrMealValidation } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const cancelMealSchema = z.object({
  type: z.enum(['volunteer', 'artist', 'participant']),
  id: z.number().int().positive(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const mealId = validateResourceId(event, 'mealId', 'repas')

    const allowed = await canAccessEditionDataOrMealValidation(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour effectuer cette action',
      })
    }

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
        status: 404,
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
          status: 404,
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
          status: 404,
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
          status: 404,
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

    return createSuccessResponse(null)
  },
  { operationName: 'CancelMeal' }
)
