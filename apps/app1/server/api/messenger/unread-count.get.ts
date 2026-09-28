import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { messengerUnreadService } from '#server/utils/messenger-unread-service'

/**
 * GET /api/messenger/unread-count
 * Retourne le nombre total de messages non lus pour l'utilisateur connecté
 *
 * Le calcul vit dans `messengerUnreadService` : ce fichier en portait une COPIE, à l'identique,
 * boucle de comptage comprise. Deux exemplaires d'une même règle finissent par ne plus dire la même
 * chose, et celui qu'on corrige n'est jamais celui que l'écran interroge.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    return createSuccessResponse(await messengerUnreadService.getUnreadCount(user.id))
  },
  { operationName: 'GetMessengerUnreadCount' }
)
