import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const { endpoint } = await readBody(event)

    if (!endpoint) {
      throw createError({
        statusCode: 400,
        message: 'Endpoint requis',
      })
    }

    try {
      // Vérifier si cette subscription existe et est active
      const subscription = await prisma.pushSubscription.findFirst({
        where: {
          userId: user.id,
          endpoint,
          isActive: true,
        },
      })

      return {
        isActive: !!subscription,
      }
    } catch (error) {
      console.error('[Push Check] Erreur lors de la vérification:', error)
      // En cas d'erreur, on retourne false par sécurité
      return {
        isActive: false,
      }
    }
  },
  { operationName: 'CheckPushSubscription' }
)
