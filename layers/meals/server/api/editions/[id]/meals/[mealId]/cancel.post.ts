import { z } from 'zod'

import { useMealsPorts } from '#server/meals/ports/registry'
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

      if (!selection || selection.volunteer.eventId !== editionId || selection.mealId !== mealId) {
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
      // Étape 2 (port artists) : annulation déléguée (le layer ne lit plus les modèles artistes).
      const res = await useMealsPorts().artists.cancelConsumed(editionId, mealId, validatedData.id)
      if (!res.ok) {
        throw createError({ status: 404, message: 'Sélection de repas non trouvée' })
      }
    } else if (validatedData.type === 'participant') {
      // Étape 2 (port ticketing) : annulation déléguée (le layer ne lit plus la billetterie).
      const res = await useMealsPorts().ticketing.cancelConsumption(
        editionId,
        mealId,
        validatedData.id
      )
      if (!res.ok) {
        throw createError({ status: 404, message: 'Participant non trouvé' })
      }
    }

    return createSuccessResponse(null)
  },
  { operationName: 'CancelMeal' }
)
