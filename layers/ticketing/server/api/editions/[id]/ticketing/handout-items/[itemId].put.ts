import { requireAuth } from '#server/utils/auth-utils'
import {
  updateHandoutItem,
  handoutItemSchema,
} from '#server/utils/editions/ticketing/handout-items'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { exigerArticlesARemettreActifs } from '#server/utils/ticketing/handout-items-actifs'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const itemId = validateResourceId(event, 'itemId', 'item')

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour modifier ces données',
      })

    // La fonctionnalité éteinte refuse les écritures. Après le contrôle des droits : qui n'a
    // pas le droit d'être là ne doit pas apprendre au passage ce que l'édition a activé.
    await exigerArticlesARemettreActifs(editionId)

    const body = await readBody(event)
    const validation = handoutItemSchema.safeParse(body)

    if (!validation.success) {
      throw createError({
        status: 400,
        // `issues` et non `errors` : depuis Zod 4, `errors` n'existe plus. On lisait donc
        // `undefined[0]`, et une saisie invalide levait une TypeError — l'utilisateur
        // recevait un 500 au lieu du message qui lui disait quoi corriger.
        message: validation.error.issues[0]?.message ?? 'Données invalides',
      })
    }

    return createSuccessResponse(await updateHandoutItem(itemId, editionId, validation.data))
  },
  { operationName: 'PUT ticketing handout item' }
)
