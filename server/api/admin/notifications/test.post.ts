import { z } from 'zod'

import { requireUserSession } from '#imports'

import { NotificationService, NotificationHelpers } from '../../../utils/notification-service'
import { prisma } from '../../../utils/prisma'

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
})

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification et les droits admin
  const { user } = await requireUserSession(event)

  if (!user?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Non authentifié',
    })
  }

  // Vérifier que l'utilisateur est un super administrateur
  const currentUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isGlobalAdmin: true },
  })

  if (!currentUser?.isGlobalAdmin) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Accès refusé - Droits super administrateur requis',
    })
  }

  const body = await readBody(event).catch(() => ({}))
  const parsed = bodySchema.parse(body)

  const targetUserId = parsed.targetUserId || user.id

  try {
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
          statusMessage: 'Type de notification de test non reconnu',
        })
    }

    return {
      success: true,
      message: 'Notification de test envoyée avec succès',
      notification,
    }
  } catch (error) {
    console.error("Erreur lors de l'envoi de la notification de test:", error)
    throw createError({
      statusCode: 500,
      statusMessage: "Erreur lors de l'envoi de la notification de test",
    })
  }
})
