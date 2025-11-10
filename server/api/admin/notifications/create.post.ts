import { requireGlobalAdminWithDbCheck } from '@@/server/utils/admin-auth'
import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { NotificationService } from '@@/server/utils/notification-service'
import { prisma } from '@@/server/utils/prisma'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { z } from 'zod'

const bodySchema = z.object({
  userId: z.number().int().positive().optional(),
  type: z.enum(['INFO', 'SUCCESS', 'WARNING', 'ERROR']),
  // Accepter les anciens champs pour rétrocompatibilité
  title: z.string().min(1).max(255).optional(),
  message: z.string().min(1).max(2000).optional(),
  // Nouveaux champs (texte libre)
  titleText: z.string().min(1).max(255).optional(),
  messageText: z.string().min(1).max(2000).optional(),
  category: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  actionUrl: z.string().url().optional(),
  actionText: z.string().max(50).optional(),
}).refine((data) => (data.title || data.titleText) && (data.message || data.messageText), {
  message: 'Titre et message sont requis (via title/message ou titleText/messageText)',
})

export default wrapApiHandler(
  async (event) => {
    // Vérifier l'authentification et les droits admin (mutualisé)
    const adminUser = await requireGlobalAdminWithDbCheck(event)

    const body = await readBody(event)
    const parsed = bodySchema.parse(body)

    // Si userId n'est pas fourni, envoyer à l'admin connecté (mode test)
    const targetUserId = parsed.userId ?? adminUser.id

    // Vérifier que l'utilisateur cible existe
    const targetUser = await fetchResourceOrFail(prisma.user, targetUserId, {
      errorMessage: 'Utilisateur cible non trouvé',
      select: { id: true, pseudo: true, email: true },
    })

    const notification = await NotificationService.create({
      userId: targetUserId,
      type: parsed.type as any,
      // Utiliser titleText/messageText en priorité, sinon les anciens champs
      titleText: parsed.titleText || parsed.title,
      messageText: parsed.messageText || parsed.message,
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
