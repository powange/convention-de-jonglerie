import { z } from 'zod'

import { requireAuth } from '../../../../utils/auth-utils'
import { canAccessEditionData } from '../../../../utils/permissions/edition-permissions'
import { prisma } from '../../../../utils/prisma'

const bodySchema = z.object({
  participantId: z.number(),
  type: z.enum(['ticket', 'volunteer']).optional().default('volunteer'),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à cette fonctionnalité',
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
    }

    return {
      success: true,
      message: 'Entrée dévalidée avec succès',
    }
  } catch (error: any) {
    console.error('Invalidate entry error:', error)
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: "Erreur lors de la dévalidation de l'entrée",
    })
  }
})
