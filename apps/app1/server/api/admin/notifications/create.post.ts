import { z } from 'zod'

import { requireGlobalAdminWithDbCheck } from '#server/utils/admin-auth'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { NotificationService } from '#server/utils/notification-service'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'

const bodySchema = z
  .object({
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
  })
  .refine((data) => (data.title || data.titleText) && (data.message || data.messageText), {
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
      // Sans notificationType, NotificationService n'envoie que la notification in-app et le push :
      // tout le bloc d'envoi d'email est conditionné à ce champ. En contrepartie, le type soumet
      // aussi l'envoi aux préférences de la personne ciblée, qui peut donc le refuser.
      notificationType: 'system_notification',
      // Utiliser titleText/messageText en priorité, sinon les anciens champs
      titleText: parsed.titleText || parsed.title,
      messageText: parsed.messageText || parsed.message,
      category: parsed.category,
      entityType: parsed.entityType,
      entityId: parsed.entityId,
      actionUrl: parsed.actionUrl,
      actionText: parsed.actionText,
    })

    // create() renvoie null quand la personne ciblée a désactivé les notifications système :
    // rien n'est créé, il ne faut donc pas annoncer un envoi réussi.
    // L'état est porté par `data` et non par `message` : côté client, useApiAction déballe
    // l'enveloppe et ne transmet que `data` à onSuccess.
    if (!notification) {
      return createSuccessResponse(
        {
          notification: null,
          targetUser,
          blocked: true,
          blockedReason: `${targetUser.pseudo} a désactivé les notifications système`,
        },
        'Notification non envoyée'
      )
    }

    return createSuccessResponse(
      { notification, targetUser, blocked: false },
      'Notification créée avec succès'
    )
  },
  { operationName: 'CreateAdminNotification' }
)
