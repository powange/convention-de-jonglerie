import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { NotificationService } from '#server/utils/notification-service'
import { canManageArtistsById } from '#server/utils/permissions/edition-permissions'
import { fetchResourceOrFail } from '#server/utils/prisma-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'

const notificationSchema = z.object({
  targetType: z.enum(['all', 'shows']),
  selectedShows: z.array(z.number().int().positive()).optional(),
  message: z
    .string()
    .min(1, 'Le message est requis')
    .max(500, 'Le message ne peut pas dépasser 500 caractères'),
})

/**
 * Envoie un message à tous les artistes d'une édition, ou à ceux d'une sélection de
 * spectacles. Décalque de l'envoi aux bénévoles, le périmètre portant sur des spectacles
 * plutôt que sur des équipes.
 *
 * Chaque destinataire reçoit une notification dans le site, par push et par e-mail — le
 * service unifié s'en charge selon ses préférences — assortie d'un lien de confirmation de
 * lecture, ce qui permet à l'organisateur de voir qui manque à l'appel.
 */
export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  if (!(await canManageArtistsById(editionId, user.id, event))) {
    throw createError({ status: 403, message: 'Droits insuffisants' })
  }

  const body = await readBody(event)
  const { targetType, selectedShows, message } = notificationSchema.parse(body)

  if (targetType === 'shows' && (!selectedShows || selectedShows.length === 0)) {
    throw createError({ status: 400, message: 'Aucun spectacle sélectionné' })
  }

  const edition = await fetchResourceOrFail(prisma.edition, editionId, {
    select: { id: true, name: true, convention: { select: { name: true } } },
    errorMessage: 'Édition introuvable',
  })

  // Un artiste joue parfois dans plusieurs spectacles visés : `distinct` évite de lui
  // envoyer le même message autant de fois.
  const artistes = await prisma.editionArtist.findMany({
    where: {
      editionId,
      ...(targetType === 'shows' ? { shows: { some: { showId: { in: selectedShows } } } } : {}),
    },
    select: { userId: true },
    distinct: ['userId'],
  })

  if (artistes.length === 0) {
    throw createError({ status: 400, message: 'Aucun artiste trouvé avec ces critères' })
  }

  const displayName = edition.name || edition.convention?.name || 'votre événement'
  const title = `Artistes - ${displayName}`

  const groupe = await prisma.artistNotificationGroup.create({
    data: {
      editionId,
      senderId: user.id,
      title,
      message,
      targetType,
      selectedShows: targetType === 'shows' ? selectedShows : undefined,
      recipientCount: artistes.length,
      sentAt: new Date(),
    },
  })

  const confirmationUrl = `/editions/${editionId}/artists/notification/${groupe.id}/confirm`

  // Une ligne par destinataire dès l'envoi, `confirmedAt` nul : c'est ce qui distingue
  // « pas encore lu » de « jamais destinataire ».
  await prisma.artistNotificationConfirmation.createMany({
    data: artistes.map((artiste) => ({
      artistNotificationGroupId: groupe.id,
      userId: artiste.userId,
      confirmedAt: null,
    })),
  })

  await Promise.all(
    artistes.map((artiste) =>
      NotificationService.create({
        userId: artiste.userId,
        type: 'INFO',
        titleText: title,
        messageText: message,
        category: 'artist',
        entityType: 'Edition',
        entityId: editionId.toString(),
        actionUrl: confirmationUrl,
        actionText: 'Confirmer la lecture',
      })
    )
  )

  return createSuccessResponse({
    recipientCount: artistes.length,
    notificationGroupId: groupe.id,
    confirmationUrl,
  })
}, { operationName: 'CreateArtistNotification' })
