import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionDataOrAccessControl } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const bodySchema = z.object({
  participantId: z.number(),
  type: z.enum(['ticket', 'volunteer', 'artist']).optional().default('volunteer'),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions (gestionnaires OU bénévoles en créneau actif de contrôle d'accès)
  const allowed = await canAccessEditionDataOrAccessControl(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message:
        "Droits insuffisants pour accéder à cette fonctionnalité - vous devez être gestionnaire ou en créneau actif de contrôle d'accès",
    })

  const body = bodySchema.parse(await readBody(event))

  try {
    if (body.type === 'volunteer') {
      // Dévalider l'entrée d'un bénévole
      const application = await prisma.editionVolunteerApplication.findFirst({
        where: {
          id: body.participantId,
          editionId: editionId,
          status: 'ACCEPTED',
        },
      })

      if (!application) {
        throw createError({
          statusCode: 404,
          message: 'Bénévole introuvable',
        })
      }

      await prisma.editionVolunteerApplication.update({
        where: { id: body.participantId },
        data: {
          entryValidated: false,
          entryValidatedAt: null,
          entryValidatedBy: null,
        },
      })

      // Notifier via SSE
      try {
        const { broadcastToEditionSSE } = await import('@@/server/utils/sse-manager')
        broadcastToEditionSSE(editionId, {
          type: 'entry-invalidated',
          editionId,
          participantType: 'volunteer',
          participantId: body.participantId,
        })
        broadcastToEditionSSE(editionId, {
          type: 'stats-updated',
          editionId,
        })
      } catch (sseError) {
        console.error('[SSE] Failed to notify SSE clients:', sseError)
      }
    } else if (body.type === 'artist') {
      // Dévalider l'entrée d'un artiste
      const artist = await prisma.editionArtist.findFirst({
        where: {
          id: body.participantId,
          editionId: editionId,
        },
      })

      if (!artist) {
        throw createError({
          statusCode: 404,
          message: 'Artiste introuvable',
        })
      }

      await prisma.editionArtist.update({
        where: { id: body.participantId },
        data: {
          entryValidated: false,
          entryValidatedAt: null,
          entryValidatedBy: null,
        },
      })

      // Notifier via SSE
      try {
        const { broadcastToEditionSSE } = await import('@@/server/utils/sse-manager')
        broadcastToEditionSSE(editionId, {
          type: 'entry-invalidated',
          editionId,
          participantType: 'artist',
          participantId: body.participantId,
        })
        broadcastToEditionSSE(editionId, {
          type: 'stats-updated',
          editionId,
        })
      } catch (sseError) {
        console.error('[SSE] Failed to notify SSE clients:', sseError)
      }
    } else {
      // Dévalider l'entrée d'un participant (ticket) en utilisant l'ID de OrderItem
      const orderItem = await prisma.ticketingOrderItem.findFirst({
        where: {
          id: body.participantId,
          order: {
            editionId: editionId,
          },
        },
      })

      if (!orderItem) {
        throw createError({
          statusCode: 404,
          message: 'Participant introuvable',
        })
      }

      await prisma.ticketingOrderItem.update({
        where: { id: orderItem.id },
        data: {
          entryValidated: false,
          entryValidatedAt: null,
        },
      })

      // Notifier via SSE
      try {
        const { broadcastToEditionSSE } = await import('@@/server/utils/sse-manager')
        broadcastToEditionSSE(editionId, {
          type: 'entry-invalidated',
          editionId,
          participantType: 'ticket',
          participantId: body.participantId,
        })
        broadcastToEditionSSE(editionId, {
          type: 'stats-updated',
          editionId,
        })
      } catch (sseError) {
        console.error('[SSE] Failed to notify SSE clients:', sseError)
      }
    }

    return {
      success: true,
      message: 'Entrée dévalidée avec succès',
    }
  } catch (error: unknown) {
    console.error('Invalidate entry error:', error)
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: "Erreur lors de la dévalidation de l'entrée",
    })
  }
})
