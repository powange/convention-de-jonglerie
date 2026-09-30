import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'

/**
 * Trois manières de désigner ce qu'on désactive, et une seule qui touche tout.
 *
 * ⚠️ CE QUI N'ALLAIT PAS. Un corps vide désactivait TOUS les tokens actifs de l'utilisateur. Or le
 * client appelait justement cette route sans corps : couper les notifications sur son téléphone les
 * coupait aussi sur son ordinateur de bureau, et sur la tablette. Rien ne le disait, et la personne
 * ne s'en apercevait qu'en ne recevant plus rien là où elle n'avait rien demandé.
 *
 * Le corps vide n'est donc PAS accepté comme « tout » : c'était précisément la forme du défaut.
 * Effacer tous ses appareils reste possible, mais il faut le demander — `all: true`.
 */
const corpsSchema = z
  .object({
    token: z.string().min(1).max(500).optional(),
    deviceId: z.string().min(1).max(200).optional(),
    /** Couper les notifications sur TOUS les appareils. Explicite, jamais déduit. */
    all: z.boolean().optional(),
  })
  .refine((corps) => Boolean(corps.token || corps.deviceId || corps.all), {
    message: 'Précisez le token, l’appareil (deviceId), ou all: true',
  })

/**
 * POST /api/notifications/fcm/unsubscribe
 * Désactive les tokens FCM d'un appareil, un token précis, ou tous les appareils.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const { token, deviceId, all } = corpsSchema.parse(await readBody(event).catch(() => ({})))

    /*
     * Hors `all`, on désactive par appareil OU par token, les deux si les deux sont fournis.
     *
     * Ce n'est pas une redondance. Firebase fait TOURNER les tokens : un même appareil peut avoir
     * plusieurs lignes, et n'en désactiver qu'une laisserait les notifications arriver. À l'inverse,
     * les lignes créées avant la colonne `deviceId` — ou quand `localStorage` était inaccessible —
     * portent `deviceId: null` et ne se retrouvent que par leur token. Chacun des deux critères
     * rattrape ce que l'autre laisse passer.
     */
    const cibles = all
      ? { userId: user.id, isActive: true }
      : {
          userId: user.id,
          OR: [...(deviceId ? [{ deviceId }] : []), ...(token ? [{ token }] : [])],
        }

    const result = await prisma.fcmToken.updateMany({
      where: cibles,
      data: { isActive: false },
    })

    return createSuccessResponse({ count: result.count }, 'Token(s) FCM désactivé(s)')
  },
  { operationName: 'UnsubscribeFcm' }
)
