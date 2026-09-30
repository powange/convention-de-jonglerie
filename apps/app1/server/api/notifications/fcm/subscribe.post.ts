import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'

const fcmSubscribeSchema = z.object({
  token: z.string().min(1, 'Token FCM requis').max(500),
  deviceId: z.string().max(200).optional(),
})

/**
 * POST /api/notifications/fcm/subscribe
 * Enregistre un token FCM pour les notifications push
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const body = await readBody(event)
    const { token, deviceId } = fcmSubscribeSchema.parse(body)

    const userAgent = getHeader(event, 'user-agent') || null

    /*
     * ⚠️ UN TOKEN APPARTIENT À UN NAVIGATEUR, PAS À UN COMPTE — et c'est ce que la contrainte
     * `@@unique([userId, token])` autorise à oublier : le MÊME token peut exister pour deux
     * comptes.
     *
     * Le scénario, sur un poste partagé : quelqu'un se connecte, s'abonne, part. La personne
     * suivante se connecte et s'abonne — Firebase rend le même token, puisque c'est la même
     * installation. Deux lignes actives portent alors le même token pour deux comptes, et les
     * notifications du PREMIER continuent d'arriver sur l'écran du SECOND. Le contenu s'affiche
     * dans la notification système : titre, message, nom de l'édition.
     *
     * On désactive donc ce token chez les AUTRES comptes. Pas chez celui-ci : l'`upsert` qui suit
     * s'en charge, et le désactiver ici pour le réactiver juste après laisserait une fenêtre où
     * l'abonné n'est abonné à rien.
     *
     * ⚠️ Cela n'efface rien : `isActive: false` garde la ligne, donc l'historique et le lien avec
     * l'appareil. Le premier compte se réabonnera à sa prochaine visite, sur son propre appareil
     * comme sur celui-ci.
     */
    await prisma.fcmToken.updateMany({
      where: {
        token,
        userId: { not: user.id },
        isActive: true,
      },
      data: { isActive: false },
    })

    await prisma.fcmToken.upsert({
      where: {
        userId_token: {
          userId: user.id,
          token,
        },
      },
      update: {
        isActive: true,
        deviceId: deviceId || undefined,
        userAgent,
      },
      create: {
        userId: user.id,
        token,
        isActive: true,
        deviceId: deviceId || null,
        userAgent,
      },
    })

    return createSuccessResponse(null, 'Token FCM enregistré')
  },
  { operationName: 'SubscribeFcm' }
)
