import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { NotificationService } from '@@/server/utils/notification-service'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const bodySchema = z.object({
  userId: z.number().int().positive(),
  type: z.enum(['INFO', 'SUCCESS', 'WARNING', 'ERROR']),
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(2000),
  category: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  actionUrl: z.string().url().optional(),
  actionText: z.string().max(50).optional(),
})

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    await requireGlobalAdminWithDbCheck(event)

    const body = await readBody(event)
    const parsed = bodySchema.parse(body)

    // Vérifier que l'utilisateur cible existe
    const targetUser = await prisma.user.findUnique({
      where: { id: parsed.userId },
      select: { id: true, pseudo: true, email: true },
    })

    if (!targetUser) {
      throw createError({
        statusCode: 404,
        message: 'Utilisateur cible non trouvé',
      })
    }

    const notification = await NotificationService.create({
      userId: parsed.userId,
      type: parsed.type as any,
      title: parsed.title,
      message: parsed.message,
      category: parsed.category,
      entityType: parsed.entityType,
      entityId: parsed.entityId,
      actionUrl: parsed.actionUrl,
      actionText: parsed.actionText,
    })

    return {
      success: true,
      message: 'Notification créée avec succès',
      notification,
      targetUser,
    }
  },
  { operationName: 'CreateAdminNotification' }
)
