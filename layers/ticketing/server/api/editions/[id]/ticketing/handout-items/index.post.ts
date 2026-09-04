import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { createHandoutItem } from '#server/utils/editions/ticketing/handout-items'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'

const createItemSchema = z.object({
  name: z.string().min(1, 'Le nom est obligatoire'),
  cumulative: z.boolean().optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour modifier ces données',
      })

    const body = await readBody(event)
    const validation = createItemSchema.safeParse(body)

    if (!validation.success) {
      throw createError({
        status: 400,
        // `issues` et non `errors` : depuis Zod 4, `errors` n'existe plus. On lisait donc
        // `undefined[0]`, et une saisie invalide levait une TypeError — l'utilisateur
        // recevait un 500 au lieu du message qui lui disait quoi corriger.
        message: validation.error.issues[0]?.message ?? 'Données invalides',
      })
    }

    try {
      return createSuccessResponse(await createHandoutItem(editionId, validation.data))
    } catch (error: unknown) {
      console.error('Failed to create handout item:', error)
      throw createError({
        status: 500,
        message: "Erreur lors de la création de l'item à remettre",
      })
    }
  },
  { operationName: 'POST ticketing handout-items index' }
)
