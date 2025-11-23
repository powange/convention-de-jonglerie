import { z } from 'zod'

import { firebaseAdmin } from '~/server/utils/firebase-admin'

const testFirebaseSchema = z.object({
  token: z.string().min(1, 'Token FCM requis'),
  title: z.string().min(1, 'Titre requis').max(100),
  body: z.string().min(1, 'Message requis').max(500),
  actionUrl: z.string().optional(),
})

/**
 * API pour tester l'envoi de notifications via Firebase Cloud Messaging
 * POST /api/admin/notifications/test-firebase
 */
export default wrapApiHandler(
  defineEventHandler(async (event) => {
    // Valider les permissions admin
    requireSuperAdmin(event, 'Accès refusé')

    // Parser et valider le body
    const body = await readBody(event)
    const validatedData = testFirebaseSchema.parse(body)

    const { token, title, body: message, actionUrl } = validatedData

    // Vérifier que Firebase Admin est disponible
    if (!firebaseAdmin.isInitialized()) {
      throw createError({
        statusCode: 503,
        message:
          'Firebase Admin SDK non configuré. Veuillez configurer FIREBASE_SERVICE_ACCOUNT dans .env',
      })
    }

    // Envoyer la notification via Firebase
    const result = await firebaseAdmin.sendToTokens(
      [token],
      {
        title,
        body: message,
      },
      {
        actionUrl: actionUrl || '/notifications',
        type: 'info',
      }
    )

    // Vérifier si l'envoi a réussi
    if (result.success === 0) {
      // Vérifier si le token est invalide
      if (result.invalidTokens.length > 0) {
        throw createError({
          statusCode: 400,
          message: 'Token FCM invalide ou expiré',
        })
      }

      throw createError({
        statusCode: 500,
        message: 'Échec de l\'envoi de la notification Firebase',
      })
    }

    return {
      success: true,
      message: 'Notification Firebase envoyée avec succès',
      result: {
        successCount: result.success,
        failureCount: result.failure,
      },
    }
  })
)
