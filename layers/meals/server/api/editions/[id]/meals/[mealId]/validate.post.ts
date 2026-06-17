import { z } from 'zod'

import { useMealsPorts } from '#server/meals/ports/registry'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionDataOrMealValidation } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const validateMealSchema = z.object({
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
    const validatedData = validateMealSchema.parse(body)

    // Vérifier que le repas existe et appartient à cette édition (l'accès billetterie est vérifié
    // par le port ticketing).
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

    const now = new Date()

    // Valider selon le type
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

      // Mise à jour atomique : ne met à jour que si consumedAt est null
      const result = await prisma.volunteerMealSelection.updateMany({
        where: { id: validatedData.id, consumedAt: null },
        data: { consumedAt: now },
      })

      if (result.count === 0) {
        throw createError({
          status: 400,
          message: 'Ce repas a déjà été validé',
        })
      }
    } else if (validatedData.type === 'artist') {
      // Étape 2 (port artists) : validation déléguée (le layer ne lit plus les modèles artistes).
      const res = await useMealsPorts().artists.markConsumed(
        editionId,
        mealId,
        validatedData.id,
        now
      )
      if (!res.ok) {
        throw res.reason === 'already'
          ? createError({ status: 400, message: 'Ce repas a déjà été validé' })
          : createError({ status: 404, message: 'Sélection de repas non trouvée' })
      }
    } else if (validatedData.type === 'participant') {
      // Étape 2 (port ticketing) : validation déléguée (le layer ne lit plus la billetterie).
      const res = await useMealsPorts().ticketing.validateConsumption(
        editionId,
        mealId,
        validatedData.id,
        now
      )
      if (!res.ok) {
        if (res.reason === 'refunded') {
          throw createError({
            status: 400,
            message: 'Ce billet a été remboursé et ne peut pas être utilisé pour valider un repas',
          })
        }
        if (res.reason === 'no_access') {
          throw createError({ status: 403, message: "Ce participant n'a pas accès à ce repas" })
        }
        if (res.reason === 'already') {
          throw createError({ status: 400, message: 'Ce repas a déjà été validé' })
        }
        throw createError({ status: 404, message: 'Participant non trouvé' })
      }
    }

    return createSuccessResponse({ consumedAt: now })
  },
  { operationName: 'ValidateMeal' }
)
