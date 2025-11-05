import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { NotificationService, NotificationHelpers } from '@@/server/utils/notification-service'
import { notificationStreamManager } from '@@/server/utils/notification-stream-manager'
import { prisma } from '@@/server/utils/prisma'
import { fetchResourceByFieldOrFail } from '@@/server/utils/prisma-helpers'
import { z } from 'zod'

const bodySchema = z.object({
  type: z.enum([
    'welcome',
    'volunteer-accepted',
    'volunteer-rejected',
    'event-reminder',
    'system-error',
    'custom',
  ]),
  message: z.string().optional(),
  targetUserId: z.number().int().positive().optional(),
  targetUserEmail: z.string().email().optional(),
})

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    const adminUser = await requireGlobalAdminWithDbCheck(event)

    const body = await readBody(event).catch(() => ({}))
    const parsed = bodySchema.parse(body)

    // Déterminer l'utilisateur cible
    let targetUserId = parsed.targetUserId || adminUser.id

    // Si un email est fourni, chercher l'utilisateur correspondant
    if (parsed.targetUserEmail) {
      const targetUser = await fetchResourceByFieldOrFail(
        prisma.user,
        'email',
        parsed.targetUserEmail,
        {
          errorMessage: `Utilisateur avec l'email ${parsed.targetUserEmail} introuvable`,
          select: { id: true },
        }
      )

      targetUserId = targetUser.id
    }

    let notification

    // Générer différents types de notifications de test
    switch (parsed.type) {
      case 'welcome':
        notification = await NotificationHelpers.welcome(targetUserId)
        break

      case 'volunteer-accepted':
        notification = await NotificationHelpers.volunteerAccepted(
          targetUserId,
          'Convention de Test 2024',
          1
        )
        break

      case 'volunteer-rejected':
        notification = await NotificationHelpers.volunteerRejected(
          targetUserId,
          'Convention de Test 2024',
          1
        )
        break

      case 'event-reminder':
        notification = await NotificationHelpers.eventReminder(
          targetUserId,
          'Convention de Test 2024',
          1,
          3
        )
        break

      case 'system-error':
        notification = await NotificationHelpers.systemError(
          targetUserId,
          "Erreur de test générée depuis l'administration"
        )
        break

      case 'custom':
        notification = await NotificationService.create({
          userId: targetUserId,
          type: 'INFO',
          title: 'Notification de test 🧪',
          message:
            parsed.message || "Ceci est une notification de test générée depuis l'administration.",
          category: 'system',
          entityType: 'Test',
          entityId: 'test-' + Date.now(),
        })
        break

      default:
        throw createError({
          statusCode: 400,
          message: 'Type de notification de test non reconnu',
        })
    }

    // Obtenir les statistiques des connexions SSE
    const streamStats = notificationStreamManager.getStats()

    return {
      success: true,
      message: 'Notification de test envoyée avec succès',
      notification,
      streamStats: {
        totalConnections: streamStats.totalConnections,
        activeUsers: streamStats.activeUsers,
        connectionsByUser: streamStats.connectionsByUser,
      },
      testInfo: {
        type: parsed.type,
        targetUserId,
        timestamp: new Date().toISOString(),
      },
    }
  },
  { operationName: 'TestNotification' }
)
