import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { pushNotificationService } from '@@/server/utils/push-notification-service'
import { z } from 'zod'

const testPushSchema = z.object({
  userId: z.number().optional(),
  userIds: z.array(z.number()).optional(),
  allUsers: z.boolean().optional(),
  title: z.string(),
  message: z.string(),
})

export default defineEventHandler(async (event) => {
  try {
    // Vérifier l'authentification et les droits admin (mutualisé)
    const adminUser = await requireGlobalAdminWithDbCheck(event)

    // Valider les données
    const body = await readBody(event)
    const data = testPushSchema.parse(body)

    console.log('[Push Test] Envoi de notification push de test')

    let result: any = {}

    if (data.allUsers) {
      // Envoyer à tous les utilisateurs
      const count = await pushNotificationService.sendToAll({
        title: data.title,
        message: data.message,
        url: '/notifications',
        actionText: 'Voir',
      })
      result = {
        success: true,
        message: `Notification envoyée à ${count} utilisateur(s)`,
        count,
      }
    } else if (data.userIds && data.userIds.length > 0) {
      // Envoyer à plusieurs utilisateurs
      const results = await pushNotificationService.sendToUsers(data.userIds, {
        title: data.title,
        message: data.message,
        url: '/notifications',
        actionText: 'Voir',
      })
      const successCount = Array.from(results.values()).filter(Boolean).length
      result = {
        success: true,
        message: `Notification envoyée à ${successCount}/${data.userIds.length} utilisateur(s)`,
        results: Object.fromEntries(results),
      }
    } else if (data.userId) {
      // Envoyer à un utilisateur spécifique
      const sent = await pushNotificationService.sendToUser(data.userId, {
        title: data.title,
        message: data.message,
        url: '/notifications',
        actionText: 'Voir',
      })
      result = {
        success: sent,
        message: sent ? 'Notification push envoyée' : 'Aucune subscription trouvée',
      }
    } else {
      // Envoyer à l'admin lui-même pour test
      console.log('[Push Test API] Test pour userId:', adminUser.id)
      const sent = await pushNotificationService.testPush(adminUser.id)
      console.log('[Push Test API] Résultat:', sent)
      result = {
        success: sent,
        message: sent ? 'Notification de test envoyée' : 'Aucune subscription trouvée',
      }
    }

    // Obtenir les stats
    const stats = await pushNotificationService.getStats()

    return {
      ...result,
      stats,
    }
  } catch (error: unknown) {
    console.error('[Push Test] Erreur:', error)

    if (error.name === 'ZodError') {
      throw createError({
        statusCode: 400,
        message: 'Données invalides',
      })
    }

    throw createError({
      statusCode: 500,
      message: error.message || "Erreur lors de l'envoi de la notification push",
    })
  }
})
