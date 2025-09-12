import { z } from 'zod'

import { prisma } from '../../../utils/prisma'

const unsubscribeSchema = z.object({
  endpoint: z.string(),
})

export default defineEventHandler(async (event) => {
  try {
    // Vérifier l'authentification
    const session = await requireUserSession(event)
    const userId = session.user.id

    // Valider les données
    const body = await readBody(event)
    const { endpoint } = unsubscribeSchema.parse(body)

    console.log("[Push Unsubscribe] Suppression de la souscription pour l'utilisateur:", userId)

    // Supprimer la subscription
    const deleted = await prisma.pushSubscription.deleteMany({
      where: {
        userId,
        endpoint,
      },
    })

    if (deleted.count === 0) {
      console.log('[Push Unsubscribe] Aucune subscription trouvée')
      return {
        success: false,
        message: 'Subscription non trouvée',
      }
    }

    console.log('[Push Unsubscribe] Subscription supprimée avec succès')
    return {
      success: true,
      message: 'Subscription supprimée',
    }
  } catch (error: any) {
    console.error('[Push Unsubscribe] Erreur:', error)

    if (error.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Données invalides',
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la suppression de la subscription',
    })
  }
})
