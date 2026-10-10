import { z } from 'zod'

import { wrapApiHandler, createPaginatedResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { NotificationService } from '#server/utils/notification-service'
import { decalageDePagination, limiteDePagination } from '#server/utils/validation-schemas'

const querySchema = z.object({
  isRead: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  category: z.string().optional(),
  /*
   * ⚠️ Mêmes bornes que les messages, et pour la même raison : `parseInt` nu laissait passer
   * `?limit=abc` en `NaN` — refusé par Prisma, donc 500 sur une saisie d'URL — et `?limit=100000`
   * chargeait toutes les notifications d'un compte. Le plafond de 100 est le quintuple du défaut.
   */
  limit: limiteDePagination(),
  offset: decalageDePagination(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const query = getQuery(event)
    const parsed = querySchema.parse(query)

    // Calculer la page à partir de l'offset et du limit pour createPaginatedResponse
    const limit = parsed.limit || 50
    const offset = parsed.offset || 0
    const page = Math.floor(offset / limit) + 1

    const filtres = {
      userId: user.id,
      isRead: parsed.isRead,
      category: parsed.category,
    }

    /**
     * La liste et son TOTAL RÉEL, demandés ensemble.
     *
     * Le total était estimé : `offset + reçues + (page pleine ? limite : 0)`. Il servait à calculer
     * `hasNextPage`, et une page exactement pleine lui faisait donc annoncer une page suivante qui
     * pouvait être vide — tandis que `totalPages` était faux dès le premier chargement. Un `count`
     * sur les mêmes filtres coûte une requête et dit la vérité.
     */
    const [notifications, total, unreadCount] = await Promise.all([
      NotificationService.getForUser({ ...filtres, limit, offset }),
      NotificationService.countForUser(filtres),
      NotificationService.getUnreadCount(user.id, parsed.category),
    ])

    // Mapper les notifications pour retirer l'email (emailHash déjà présent)
    const mappedNotifications = notifications.map((notification) => ({
      ...notification,
      user: {
        id: notification.user.id,
        pseudo: notification.user.pseudo,
        emailHash: notification.user.emailHash,
        profilePicture: notification.user.profilePicture,
      },
    }))

    return {
      ...createPaginatedResponse(mappedNotifications, total, page, limit),
      unreadCount,
    }
  },
  { operationName: 'GetUserNotifications' }
)
