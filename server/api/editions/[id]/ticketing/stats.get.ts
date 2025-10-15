import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'

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

  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Récupérer la configuration de billeterie
    const config = await prisma.externalTicketing.findUnique({
      where: { editionId },
    })

    // Compter les validations de billets
    const ticketsValidatedToday = config
      ? await prisma.ticketingOrderItem.count({
          where: {
            order: {
              externalTicketingId: config.id,
            },
            entryValidated: true,
            entryValidatedAt: {
              gte: today,
            },
          },
        })
      : 0

    const totalTicketsValidated = config
      ? await prisma.ticketingOrderItem.count({
          where: {
            order: {
              externalTicketingId: config.id,
            },
            entryValidated: true,
          },
        })
      : 0

    // Compter les validations de bénévoles
    const volunteersValidatedToday = await prisma.editionVolunteerApplication.count({
      where: {
        editionId: editionId,
        entryValidated: true,
        entryValidatedAt: {
          gte: today,
        },
      },
    })

    const totalVolunteersValidated = await prisma.editionVolunteerApplication.count({
      where: {
        editionId: editionId,
        entryValidated: true,
      },
    })

    // Compter le nombre total de billets et bénévoles
    const totalTickets = config
      ? await prisma.ticketingOrderItem.count({
          where: {
            order: {
              externalTicketingId: config.id,
            },
          },
        })
      : 0

    const totalVolunteers = await prisma.editionVolunteerApplication.count({
      where: {
        editionId: editionId,
        status: 'ACCEPTED',
      },
    })

    return {
      success: true,
      stats: {
        validatedToday: ticketsValidatedToday + volunteersValidatedToday,
        totalValidated: totalTicketsValidated + totalVolunteersValidated,
        ticketsValidated: totalTicketsValidated,
        volunteersValidated: totalVolunteersValidated,
        ticketsValidatedToday: ticketsValidatedToday,
        volunteersValidatedToday: volunteersValidatedToday,
        totalTickets: totalTickets,
        totalVolunteers: totalVolunteers,
      },
    }
  } catch (error: unknown) {
    console.error('Database stats error:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des statistiques',
    })
  }
})
