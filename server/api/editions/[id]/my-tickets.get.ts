import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

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

    // Récupérer le statut d'organisateur de l'utilisateur pour cette édition
    const editionOrganizer = await prisma.editionOrganizer.findFirst({
      where: {
        editionId,
        organizer: {
          userId: user.id,
        },
      },
      include: {
        organizer: {
          include: {
            user: true,
          },
        },
      },
    })

    if (editionOrganizer) {
      allTickets.push({
        id: editionOrganizer.id,
        type: 'organizer',
        firstName: editionOrganizer.organizer.user.prenom,
        lastName: editionOrganizer.organizer.user.nom,
        email: editionOrganizer.organizer.user.email,
        qrCode: `organizer-${editionOrganizer.id}`,
        tierName: 'Organisateur',
        amount: 0,
        isHelloAsso: false,
        entryValidated: editionOrganizer.entryValidated,
        entryValidatedAt: editionOrganizer.entryValidatedAt,
      })
    }

    return {
      tickets: allTickets,
    }
  },
  { operationName: 'GetMyTickets' }
)
