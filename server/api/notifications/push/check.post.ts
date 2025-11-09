import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { prisma } from '@@/server/utils/prisma'

export default wrapApiHandler(
  async (event) => {
    const session = await requireUserSession(event)
    const userId = session.user.id
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
          userId,
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
