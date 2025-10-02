import { z } from 'zod'

import { canAccessEditionData } from '../../../../utils/edition-permissions'
import { prisma } from '../../../../utils/prisma'

const bodySchema = z.object({
  qrCode: z.string().min(1),
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
    // Détecter le type de QR code
    if (body.qrCode.startsWith('volunteer-')) {
      // Recherche d'un bénévole
      const applicationId = parseInt(body.qrCode.replace('volunteer-', ''))

      if (isNaN(applicationId)) {
        return {
          success: true,
          found: false,
          message: 'QR code bénévole invalide',
        }
      }

      const application = await prisma.volunteerApplication.findFirst({
        where: {
          id: applicationId,
          editionId: editionId,
          status: 'ACCEPTED',
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          teamAssignments: {
            include: {
              team: true,
            },
          },
          timeSlotAssignments: {
            include: {
              timeSlot: {
                include: {
                  team: true,
                },
              },
            },
          },
        },
      })

      if (application) {
        return {
          success: true,
          found: true,
          type: 'volunteer',
          participant: {
            found: true,
            volunteer: {
              id: application.id,
              user: {
                firstName: application.user.firstName,
                lastName: application.user.lastName,
                email: application.user.email,
              },
              teams: application.teamAssignments.map((assignment) => ({
                id: assignment.team.id,
                name: assignment.team.name,
                isLeader: assignment.isLeader,
              })),
              timeSlots: application.timeSlotAssignments.map((assignment) => ({
                id: assignment.timeSlot.id,
                title: assignment.timeSlot.title,
                team: assignment.timeSlot.team?.name,
                startDateTime: assignment.timeSlot.startDateTime,
                endDateTime: assignment.timeSlot.endDateTime,
              })),
            },
          },
          message: `Bénévole trouvé : ${application.user.firstName} ${application.user.lastName}`,
        }
      } else {
        return {
          success: true,
          found: false,
          message: 'Aucun bénévole accepté trouvé avec ce QR code',
        }
      }
    } else {
      // Recherche d'un billet HelloAsso
      const config = await prisma.externalTicketing.findUnique({
        where: { editionId },
        include: {
          helloAssoConfig: true,
        },
      })

      if (!config || !config.helloAssoConfig) {
        throw createError({
          statusCode: 404,
          message: 'Configuration HelloAsso introuvable',
        })
      }

      const orderItem = await prisma.helloAssoOrderItem.findFirst({
        where: {
          qrCode: body.qrCode,
          order: {
            externalTicketingId: config.id,
          },
        },
        include: {
          order: true,
        },
      })

      if (orderItem) {
        return {
          success: true,
          found: true,
          type: 'ticket',
          participant: {
            found: true,
            ticket: {
              id: orderItem.helloAssoItemId,
              name: orderItem.name,
              amount: orderItem.amount,
              state: orderItem.state,
              qrCode: orderItem.qrCode,
              user: {
                firstName: orderItem.firstName,
                lastName: orderItem.lastName,
                email: orderItem.email,
              },
              order: {
                id: orderItem.order.helloAssoOrderId,
                payer: {
                  firstName: orderItem.order.payerFirstName,
                  lastName: orderItem.order.payerLastName,
                  email: orderItem.order.payerEmail,
                },
              },
              customFields: orderItem.customFields as any,
            },
          },
          message: `Billet trouvé pour ${orderItem.firstName} ${orderItem.lastName}`,
        }
      } else {
        return {
          success: true,
          found: false,
          message: 'Aucun billet trouvé avec ce QR code',
        }
      }
    }
  } catch (error: any) {
    console.error('Database verify QR code error:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la recherche du billet',
    })
  }
})
