import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { canManageMealsById } from '#server/utils/permissions/edition-permissions'

const updateOrganizerMealsSchema = z.object({
  selections: z
    .array(
      z.object({
        mealId: z.number().int().positive(),
        accepted: z.boolean(),
      })
    )
    .optional(),
  dietaryPreference: z.enum(['NONE', 'VEGETARIAN', 'VEGAN']).optional(),
  allergies: z.string().optional().nullable(),
  allergySeverity: z.enum(['LIGHT', 'MODERATE', 'SEVERE', 'CRITICAL']).optional().nullable(),
})

/**
 * Met à jour les repas d'un organisateur présent sur l'édition.
 *
 * Seules les exceptions sont stockées : recocher un repas supprime la ligne (sauf si une
 * consommation y est tracée, auquel cas on se contente de repasser `accepted` à true).
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)
    const editionOrganizerId = validateResourceId(event, 'editionOrganizerId', 'organisateur')

    const allowed = await canManageMealsById(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer les repas',
      })
    }

    const body = updateOrganizerMealsSchema.parse(await readBody(event))

    const editionOrganizer = await prisma.editionOrganizer.findFirst({
      where: { id: editionOrganizerId, editionId },
      select: { id: true },
    })

    if (!editionOrganizer) {
      throw createError({
        status: 404,
        message: 'Organisateur introuvable sur cette édition',
      })
    }

    if (body.selections && body.selections.length > 0) {
      // Sécurité : ne traiter que des repas de cette édition
      const meals = await prisma.volunteerMeal.findMany({
        where: { editionId, id: { in: body.selections.map((s) => s.mealId) } },
        select: { id: true },
      })
      const validMealIds = new Set(meals.map((m) => m.id))

      for (const selection of body.selections) {
        if (!validMealIds.has(selection.mealId)) continue

        if (!selection.accepted) {
          await prisma.organizerMealSelection.upsert({
            where: {
              editionOrganizerId_mealId: { editionOrganizerId, mealId: selection.mealId },
            },
            create: { editionOrganizerId, mealId: selection.mealId, accepted: false },
            update: { accepted: false },
          })
        } else {
          // Repas accepté = comportement par défaut : on supprime l'exception, sauf si une
          // consommation est déjà tracée sur la ligne.
          const deleted = await prisma.organizerMealSelection.deleteMany({
            where: { editionOrganizerId, mealId: selection.mealId, consumedAt: null },
          })
          if (deleted.count === 0) {
            await prisma.organizerMealSelection.updateMany({
              where: { editionOrganizerId, mealId: selection.mealId },
              data: { accepted: true },
            })
          }
        }
      }
    }

    const hasDietaryUpdate =
      body.dietaryPreference !== undefined ||
      body.allergies !== undefined ||
      body.allergySeverity !== undefined

    if (hasDietaryUpdate) {
      await prisma.editionOrganizer.update({
        where: { id: editionOrganizerId },
        data: {
          dietaryPreference: body.dietaryPreference ?? undefined,
          allergies: body.allergies === undefined ? undefined : body.allergies,
          allergySeverity: body.allergySeverity === undefined ? undefined : body.allergySeverity,
        },
      })
    }

    const [meals, selections, organizer] = await Promise.all([
      prisma.volunteerMeal.findMany({
        where: { editionId, enabled: true },
        orderBy: [{ date: 'asc' }, { mealType: 'asc' }],
      }),
      prisma.organizerMealSelection.findMany({ where: { editionOrganizerId } }),
      prisma.editionOrganizer.findUnique({
        where: { id: editionOrganizerId },
        select: { dietaryPreference: true, allergies: true, allergySeverity: true },
      }),
    ])
    const selectionsByMealId = new Map(selections.map((s) => [s.mealId, s]))

    return createSuccessResponse({
      meals: meals.map((meal) => {
        const selection = selectionsByMealId.get(meal.id)
        return {
          id: meal.id,
          date: meal.date,
          mealType: meal.mealType,
          phases: meal.phases,
          accepted: selection?.accepted ?? true,
          consumedAt: selection?.consumedAt ?? null,
        }
      }),
      dietaryPreference: organizer?.dietaryPreference ?? 'NONE',
      allergies: organizer?.allergies ?? null,
      allergySeverity: organizer?.allergySeverity ?? null,
    })
  },
  { operationName: 'UpdateOrganizerMeals' }
)
