import { z } from 'zod'

import { canAccessEditionData } from '../../../../utils/edition-permissions'
import { prisma } from '../../../../utils/prisma'

const bodySchema = z.object({
  searchTerm: z.string().min(1),
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
  const searchTerm = body.searchTerm.toLowerCase().trim()

  try {
    // Récupérer la configuration de billeterie
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

    // Rechercher dans les billets HelloAsso
    const orderItems = await prisma.helloAssoOrderItem.findMany({
      where: {
        order: {
          externalTicketingId: config.id,
        },
        OR: [
          {
            firstName: {
              contains: searchTerm,
            },
          },
          {
            lastName: {
              contains: searchTerm,
            },
          },
          {
            email: {
              contains: searchTerm,
            },
          },
        ],
      },
      include: {
        order: {
          include: {
            items: {
              orderBy: { id: 'asc' },
            },
          },
        },
      },
      take: 20, // Limiter à 20 résultats
    })

    // Rechercher dans les bénévoles
    const volunteers = await prisma.editionVolunteerApplication.findMany({
      where: {
        editionId: editionId,
        status: 'ACCEPTED',
        OR: [
          {
            user: {
              prenom: {
                contains: searchTerm,
              },
            },
          },
          {
            user: {
              nom: {
                contains: searchTerm,
              },
            },
          },
          {
            user: {
              email: {
                contains: searchTerm,
              },
            },
          },
        ],
      },
      select: {
        id: true,
        entryValidated: true,
        entryValidatedAt: true,
        entryValidatedBy: true,
        user: {
          select: {
            id: true,
            prenom: true,
            nom: true,
            email: true,
          },
        },
        teamAssignments: {
          select: {
            team: {
              select: {
                id: true,
                name: true,
              },
            },
            isLeader: true,
          },
        },
      },
      take: 20, // Limiter à 20 résultats
    })

    // Récupérer les utilisateurs qui ont validé les bénévoles
    const volunteerValidatorIds = volunteers
      .filter((v) => v.entryValidatedBy)
      .map((v) => v.entryValidatedBy!)
    const validatorUsers = await prisma.user.findMany({
      where: { id: { in: volunteerValidatorIds } },
      select: { id: true, prenom: true, nom: true },
    })
    const validatorMap = new Map(validatorUsers.map((u) => [u.id, u]))

    // Récupérer les créneaux assignés aux bénévoles
    const volunteerUserIds = volunteers.map((v) => v.user.id)
    const volunteerAssignments = await prisma.volunteerAssignment.findMany({
      where: {
        userId: { in: volunteerUserIds },
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
    // Grouper les assignments par userId
    const assignmentsByUserId = new Map<number, typeof volunteerAssignments>()
    volunteerAssignments.forEach((assignment) => {
      if (!assignmentsByUserId.has(assignment.userId)) {
        assignmentsByUserId.set(assignment.userId, [])
      }
      assignmentsByUserId.get(assignment.userId)!.push(assignment)
    })

    const results = {
      tickets: orderItems.map((item) => ({
        type: 'ticket',
        participant: {
          found: true,
          ticket: {
            id: item.helloAssoItemId,
            name: item.name,
            amount: item.amount,
            state: item.state,
            qrCode: item.qrCode,
            user: {
              firstName: item.firstName,
              lastName: item.lastName,
              email: item.email,
            },
            order: {
              id: item.order.helloAssoOrderId,
              payer: {
                firstName: item.order.payerFirstName,
                lastName: item.order.payerLastName,
                email: item.order.payerEmail,
              },
              items: item.order.items.map((orderItem) => ({
                id: orderItem.helloAssoItemId,
                name: orderItem.name,
                amount: orderItem.amount,
                state: orderItem.state,
                qrCode: orderItem.qrCode,
                firstName: orderItem.firstName,
                lastName: orderItem.lastName,
                email: orderItem.email,
                customFields: orderItem.customFields as any,
                entryValidated: orderItem.entryValidated,
                entryValidatedAt: orderItem.entryValidatedAt,
              })),
            },
            customFields: item.customFields as any,
            entryValidated: item.entryValidated,
            entryValidatedAt: item.entryValidatedAt,
          },
        },
      })),
      volunteers: volunteers.map((application) => {
        const validator = application.entryValidatedBy
          ? validatorMap.get(application.entryValidatedBy)
          : null
        const assignments = assignmentsByUserId.get(application.user.id) || []
        return {
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
              timeSlots: assignments.map((assignment) => ({
                id: assignment.timeSlot.id,
                title: assignment.timeSlot.title,
                team: assignment.timeSlot.team?.name,
                startDateTime: assignment.timeSlot.startDateTime,
                endDateTime: assignment.timeSlot.endDateTime,
              })),
              entryValidated: application.entryValidated,
              entryValidatedAt: application.entryValidatedAt,
              entryValidatedBy: validator
                ? {
                    firstName: validator.prenom,
                    lastName: validator.nom,
                  }
                : null,
            },
          },
        }
      }),
      total: orderItems.length + volunteers.length,
    }

    return {
      success: true,
      results,
    }
  } catch (error: any) {
    console.error('Database search error:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la recherche de billets',
    })
  }
})
