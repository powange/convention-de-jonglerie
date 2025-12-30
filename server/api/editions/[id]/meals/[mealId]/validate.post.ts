import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionDataOrMealValidation } from '@@/server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '@@/server/utils/validation-helpers'
import { z } from 'zod'

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
        statusCode: 403,
        message: 'Droits insuffisants pour effectuer cette action',
      })
    }

    const body = await readBody(event)
    const validatedData = validateMealSchema.parse(body)

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

      // Mettre à jour la date de consommation
      await prisma.volunteerMealSelection.update({
        where: { id: validatedData.id },
        data: { consumedAt: now },
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

      // Mettre à jour la date de consommation
      await prisma.artistMealSelection.update({
        where: { id: validatedData.id },
        data: { consumedAt: now },
      })
    } else if (validatedData.type === 'participant') {
      // L'id correspond à un orderItemId
      const orderItem = await prisma.ticketingOrderItem.findUnique({
        where: { id: validatedData.id },
        include: {
          order: true,
          tier: true,
          selectedOptions: {
            select: { optionId: true },
          },
        },
      })

      if (!orderItem || orderItem.order.editionId !== editionId) {
        throw createError({
          statusCode: 404,
          message: 'Participant non trouvé',
        })
      }

      // Vérifier que le tarif du participant donne accès à ce repas
      let hasAccess = false

      if (orderItem.tierId) {
        const tierMeal = await prisma.ticketingTierMeal.findUnique({
          where: {
            tierId_mealId: {
              tierId: orderItem.tierId,
              mealId,
            },
          },
        })
        hasAccess = !!tierMeal
      }

      // Si pas d'accès via le tarif, vérifier les options
      if (!hasAccess && orderItem.selectedOptions.length > 0) {
        const optionIds = orderItem.selectedOptions.map((so) => so.optionId)
        const optionMeal = await prisma.ticketingOptionMeal.findFirst({
          where: {
            optionId: { in: optionIds },
            mealId,
          },
        })
        hasAccess = !!optionMeal
      }

      if (!hasAccess) {
        throw createError({
          statusCode: 403,
          message: "Ce participant n'a pas accès à ce repas",
        })
      }

      // Créer ou mettre à jour la validation de repas
      await prisma.ticketingOrderItemMeal.upsert({
        where: {
          orderItemId_mealId: {
            orderItemId: validatedData.id,
            mealId,
          },
        },
        create: {
          orderItemId: validatedData.id,
          mealId,
          consumedAt: now,
        },
        update: {
          consumedAt: now,
        },
      })
    }

    return {
      success: true,
      consumedAt: now,
    }
  },
  { operationName: 'ValidateMeal' }
)
