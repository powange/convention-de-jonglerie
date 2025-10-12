import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const bodySchema = z.object({
  participantIds: z.array(z.number()).min(1),
  type: z.enum(['ticket', 'volunteer']).optional().default('ticket'),
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
          entryValidatedBy: user.id,
        },
      })

      return {
        success: true,
        validated: result.count,
        message: `${result.count} bénévole${result.count > 1 ? 's' : ''} validé${result.count > 1 ? 's' : ''}`,
      }
    } else {
      // Valider les billets en utilisant l'ID de OrderItem
      const result = await prisma.ticketingOrderItem.updateMany({
        where: {
          id: {
            in: body.participantIds,
          },
          order: {
            editionId: editionId,
          },
        },
        data: {
          entryValidated: true,
          entryValidatedAt: new Date(),
          entryValidatedBy: user.id,
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
