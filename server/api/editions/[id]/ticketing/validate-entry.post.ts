import { z } from 'zod'

import { canAccessEditionData } from '../../../../utils/edition-permissions'
import { prisma } from '../../../../utils/prisma'

const bodySchema = z.object({
  participantIds: z.array(z.number()).min(1),
  type: z.enum(['ticket', 'volunteer']).optional().default('ticket'),
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à cette fonctionnalité',
    })

  const body = bodySchema.parse(await readBody(event))

  try {
    if (body.type === 'volunteer') {
      // Valider les bénévoles
      const result = await prisma.editionVolunteerApplication.updateMany({
        where: {
          id: {
            in: body.participantIds,
          },
          editionId: editionId,
          status: 'ACCEPTED',
        },
        data: {
          entryValidated: true,
          entryValidatedAt: new Date(),
          entryValidatedBy: event.context.user.id,
        },
      })

      return {
        success: true,
        validated: result.count,
        message: `${result.count} bénévole${result.count > 1 ? 's' : ''} validé${result.count > 1 ? 's' : ''}`,
      }
    } else {
      // Valider les billets
      const config = await prisma.externalTicketing.findUnique({
        where: { editionId },
        include: {
          helloAssoOrders: {
            where: {
              items: {
                some: {
                  helloAssoItemId: {
                    in: body.participantIds,
                  },
                },
              },
            },
            include: {
              items: {
                where: {
                  helloAssoItemId: {
                    in: body.participantIds,
                  },
                },
              },
            },
          },
        },
      })

      if (!config) {
        throw createError({
          statusCode: 404,
          message: 'Configuration de billeterie introuvable',
        })
      }

      // Mettre à jour les items pour marquer l'entrée comme validée
      const result = await prisma.helloAssoOrderItem.updateMany({
        where: {
          helloAssoItemId: {
            in: body.participantIds,
          },
          order: {
            externalTicketingId: config.id,
          },
        },
        data: {
          entryValidated: true,
          entryValidatedAt: new Date(),
          entryValidatedBy: event.context.user.id,
        },
      })

      return {
        success: true,
        validated: result.count,
        message: `${result.count} participant${result.count > 1 ? 's' : ''} validé${result.count > 1 ? 's' : ''}`,
      }
    }
  } catch (error: any) {
    console.error('Database validate entry error:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la validation des entrées',
    })
  }
})
