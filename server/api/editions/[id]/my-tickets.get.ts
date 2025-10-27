import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) {
    throw createError({ statusCode: 400, message: 'Edition invalide' })
  }

  try {
    const allTickets: any[] = []

    // Récupérer tous les billets de l'utilisateur pour cette édition
    const tickets = await prisma.ticketingOrderItem.findMany({
      where: {
        email: user.email,
        order: {
          editionId,
        },
        type: {
          not: 'Donation',
        },
      },
      include: {
        order: true,
        tier: true,
      },
      orderBy: {
        id: 'asc',
      },
    })

    allTickets.push(
      ...tickets.map((ticket) => ({
        id: ticket.id,
        type: 'ticket',
        firstName: ticket.firstName,
        lastName: ticket.lastName,
        email: ticket.email,
        qrCode: ticket.qrCode,
        tierName: ticket.name,
        amount: ticket.amount,
        isHelloAsso: !!ticket.order.helloAssoOrderId,
        entryValidated: ticket.entryValidated,
        entryValidatedAt: ticket.entryValidatedAt,
      }))
    )

    // Récupérer la candidature bénévole acceptée de l'utilisateur
    const volunteerApplication = await prisma.editionVolunteerApplication.findFirst({
      where: {
        userId: user.id,
        editionId,
        status: 'ACCEPTED',
      },
      include: {
        user: true,
      },
    })

    if (volunteerApplication) {
      allTickets.push({
        id: volunteerApplication.id,
        type: 'volunteer',
        firstName: volunteerApplication.user.prenom,
        lastName: volunteerApplication.user.nom,
        email: volunteerApplication.user.email,
        qrCode: `volunteer-${volunteerApplication.id}`,
        tierName: 'Bénévole',
        amount: 0,
        isHelloAsso: false,
        entryValidated: volunteerApplication.entryValidated,
        entryValidatedAt: volunteerApplication.entryValidatedAt,
      })
    }

    // Récupérer l'artiste de l'utilisateur pour cette édition
    const artist = await prisma.editionArtist.findFirst({
      where: {
        userId: user.id,
        editionId,
      },
      include: {
        user: true,
      },
    })

    if (artist) {
      allTickets.push({
        id: artist.id,
        type: 'artist',
        firstName: artist.user.prenom,
        lastName: artist.user.nom,
        email: artist.user.email,
        qrCode: `artist-${artist.id}`,
        tierName: 'Artiste',
        amount: 0,
        isHelloAsso: false,
        entryValidated: artist.entryValidated,
        entryValidatedAt: artist.entryValidatedAt,
      })
    }

    return {
      tickets: allTickets,
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des billets:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la récupération des billets',
    })
  }
})
