import { requireAuth } from '../../../utils/auth-utils'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
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
        isActive: true, // Vérifier que la subscription est active
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
})
