import { z } from 'zod'

import { canAccessEditionData } from '../../../../utils/permissions/edition-permissions'
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

      const application = await prisma.editionVolunteerApplication.findFirst({
        where: {
          id: applicationId,
          editionId: editionId,
          status: 'ACCEPTED',
        },
        include: {
          user: {
            select: {
              prenom: true,
              nom: true,
              email: true,
            },
          },
          teamAssignments: {
            include: {
              team: true,
            },
          },
        },
      })

      if (application) {
        // Récupérer l'utilisateur qui a validé si applicable
        let validatedByUser = null
        if (application.entryValidatedBy) {
          validatedByUser = await prisma.user.findUnique({
            where: { id: application.entryValidatedBy },
            select: {
              prenom: true,
              nom: true,
            },
          })
        }

        // Récupérer les créneaux assignés au bénévole
        const volunteerAssignments = await prisma.volunteerAssignment.findMany({
          where: {
            userId: application.userId,
            timeSlot: {
              editionId: editionId,
            },
          },
          include: {
            timeSlot: {
              include: {
                team: true,
              },
            },
          },
          orderBy: {
            timeSlot: {
              startDateTime: 'asc',
            },
          },
        })

        // Récupérer les articles à restituer pour les bénévoles
        const volunteerReturnableItems = await prisma.editionVolunteerReturnableItem.findMany({
          where: { editionId },
          include: {
            returnableItem: true,
          },
        })

        return {
          success: true,
          found: true,
          type: 'volunteer',
          participant: {
            found: true,
            volunteer: {
              id: application.id,
              user: {
                firstName: application.user.prenom,
                lastName: application.user.nom,
                email: application.user.email,
              },
              teams: application.teamAssignments.map((assignment) => ({
                id: assignment.team.id,
                name: assignment.team.name,
                isLeader: assignment.isLeader,
              })),
              timeSlots: volunteerAssignments.map((assignment) => ({
                id: assignment.timeSlot.id,
                title: assignment.timeSlot.title,
                team: assignment.timeSlot.team?.name,
                startDateTime: assignment.timeSlot.startDateTime,
                endDateTime: assignment.timeSlot.endDateTime,
              })),
              returnableItems: volunteerReturnableItems.map((item) => ({
                id: item.returnableItem.id,
                name: item.returnableItem.name,
              })),
              entryValidated: application.entryValidated,
              entryValidatedAt: application.entryValidatedAt,
              entryValidatedBy: validatedByUser
                ? {
                    firstName: validatedByUser.prenom,
                    lastName: validatedByUser.nom,
                  }
                : null,
            },
          },
          message: `Bénévole trouvé : ${application.user.prenom} ${application.user.nom}`,
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
            editionId: editionId,
          },
        },
        include: {
          order: {
            include: {
              items: {
                include: {
                  tier: {
                    include: {
                      returnableItems: {
                        include: {
                          returnableItem: true,
                        },
                      },
                    },
                  },
                },
                orderBy: { id: 'asc' },
              },
            },
          },
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
              id: orderItem.id, // ID de HelloAssoOrderItem
              helloAssoItemId: orderItem.helloAssoItemId,
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
                items: orderItem.order.items.map((item) => ({
                  id: item.id, // ID de HelloAssoOrderItem (au lieu de helloAssoItemId qui peut être null)
                  helloAssoItemId: item.helloAssoItemId,
                  name: item.name,
                  type: item.type,
                  amount: item.amount,
                  state: item.state,
                  qrCode: item.qrCode,
                  firstName: item.firstName,
                  lastName: item.lastName,
                  email: item.email,
                  customFields: item.customFields as any,
                  entryValidated: item.entryValidated,
                  entryValidatedAt: item.entryValidatedAt,
                  tier: item.tier
                    ? {
                        id: item.tier.id,
                        name: item.tier.name,
                        returnableItems: item.tier.returnableItems.map((ri) => ({
                          returnableItem: {
                            id: ri.returnableItem.id,
                            name: ri.returnableItem.name,
                          },
                        })),
                      }
                    : null,
                })),
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
