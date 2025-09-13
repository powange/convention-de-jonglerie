import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '../../../utils/admin-auth'
import { NotificationService } from '../../../utils/notification-service'
import { prisma } from '../../../utils/prisma'

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

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification et les droits admin (mutualisé)
  await requireGlobalAdminWithDbCheck(event)

  const body = await readBody(event)
  const parsed = bodySchema.parse(body)

  try {
    // Vérifier que l'utilisateur cible existe
    const targetUser = await prisma.user.findUnique({
      where: { id: parsed.userId },
      select: { id: true, pseudo: true, email: true },
    })

    if (!targetUser) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Utilisateur cible non trouvé',
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
  } catch (error) {
    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Erreur lors de la création de la notification',
    })
  }
})
