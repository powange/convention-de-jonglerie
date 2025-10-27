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

    // Compter les validations de billets (externes et manuels, hors donations)
    // Note: type peut être null pour les participants ajoutés manuellement
    const ticketsValidatedToday = await prisma.ticketingOrderItem.count({
      where: {
        order: {
          editionId: editionId,
        },
        OR: [{ type: { not: 'Donation' } }, { type: null }],
        entryValidated: true,
        entryValidatedAt: {
          gte: today,
        },
      },
    })

    const totalTicketsValidated = await prisma.ticketingOrderItem.count({
      where: {
        order: {
          editionId: editionId,
        },
        OR: [{ type: { not: 'Donation' } }, { type: null }],
        entryValidated: true,
      },
    })

    // Compter les validations de bénévoles (uniquement ACCEPTED et disponibles pendant l'événement)
    const volunteersValidatedToday = await prisma.editionVolunteerApplication.count({
      where: {
        editionId: editionId,
        status: 'ACCEPTED',
        entryValidated: true,
        entryValidatedAt: {
          gte: today,
        },
        OR: [
          {
            eventAvailability: true,
          },
          {
            eventAvailability: null, // Inclure les anciens bénévoles (avant l'ajout de ce champ)
          },
        ],
      },
    })

    const totalVolunteersValidated = await prisma.editionVolunteerApplication.count({
      where: {
        editionId: editionId,
        status: 'ACCEPTED',
        entryValidated: true,
        OR: [
          {
            eventAvailability: true,
          },
          {
            eventAvailability: null, // Inclure les anciens bénévoles (avant l'ajout de ce champ)
          },
        ],
      },
    })

    // Compter les validations d'artistes
    const artistsValidatedToday = await prisma.editionArtist.count({
      where: {
        editionId: editionId,
        entryValidated: true,
        entryValidatedAt: {
          gte: today,
        },
      },
    })

    const totalArtistsValidated = await prisma.editionArtist.count({
      where: {
        editionId: editionId,
        entryValidated: true,
      },
    })

    // Compter le nombre total de billets (externes et manuels, hors donations) et bénévoles
    // Utiliser la même approche que orders.get.ts pour garantir la cohérence
    // Note: type peut être null pour les participants ajoutés manuellement
    const allOrders = await prisma.ticketingOrder.findMany({
      where: { editionId },
      select: {
        items: {
          select: {
            type: true,
          },
        },
      },
    })

    const totalTickets = allOrders.reduce((sum, order) => {
      // Exclure uniquement les donations (inclut null, Registration, etc.)
      const ticketItems = order.items.filter((item) => item.type !== 'Donation')
      return sum + ticketItems.length
    }, 0)

    const totalVolunteers = await prisma.editionVolunteerApplication.count({
      where: {
        editionId: editionId,
        status: 'ACCEPTED',
        OR: [
          {
            eventAvailability: true,
          },
          {
            eventAvailability: null, // Inclure les anciens bénévoles (avant l'ajout de ce champ)
          },
        ],
      },
    })

    const totalArtists = await prisma.editionArtist.count({
      where: {
        editionId: editionId,
      },
    })

    return {
      success: true,
      stats: {
        validatedToday: ticketsValidatedToday + volunteersValidatedToday + artistsValidatedToday,
        totalValidated: totalTicketsValidated + totalVolunteersValidated + totalArtistsValidated,
        ticketsValidated: totalTicketsValidated,
        volunteersValidated: totalVolunteersValidated,
        artistsValidated: totalArtistsValidated,
        ticketsValidatedToday: ticketsValidatedToday,
        volunteersValidatedToday: volunteersValidatedToday,
        artistsValidatedToday: artistsValidatedToday,
        totalTickets: totalTickets,
        totalVolunteers: totalVolunteers,
        totalArtists: totalArtists,
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
