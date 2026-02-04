import { z } from 'zod'

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

    // Vérifier que le repas existe et appartient à cette édition
    // On inclut les relations tiers et options pour vérifier l'accès
    const meal = await prisma.volunteerMeal.findFirst({
      where: {
        id: mealId,
        editionId,
      },
      include: {
        tiers: { select: { tierId: true } },
        options: { select: { optionId: true } },
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
          status: 404,
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
          status: 404,
          message: 'Participant non trouvé',
        })
      }

      // Vérifier que le tarif ou les options du participant donnent accès à ce repas
      // Utiliser les relations déjà chargées avec le meal
      const mealTierIds = new Set(meal.tiers.map((t) => t.tierId))
      const mealOptionIds = new Set(meal.options.map((o) => o.optionId))

      let hasAccess = false

      // Vérifier l'accès via le tarif
      if (orderItem.tierId && mealTierIds.has(orderItem.tierId)) {
        hasAccess = true
      }

      // Si pas d'accès via le tarif, vérifier les options
      if (!hasAccess && orderItem.selectedOptions.length > 0) {
        hasAccess = orderItem.selectedOptions.some((so) => mealOptionIds.has(so.optionId))
      }

      if (!hasAccess) {
        throw createError({
          status: 403,
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
