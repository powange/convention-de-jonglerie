import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

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
        // La provenance, et non plus le seul identifiant HelloAsso : la carte ne savait afficher
        // qu'un logo sur deux, et un billet Infomaniak restait sans origine.
        order: { include: { externalTicketing: { select: { provider: true } } } },
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
        /** `null` quand le billet a été créé sur place ; absent pour ce qui n'est pas un billet. */
        provider: ticket.order.externalTicketing?.provider ?? null,
        entryValidated: ticket.entryValidated,
        entryValidatedAt: ticket.entryValidatedAt,
      }))
    )

    // Récupérer la candidature bénévole acceptée de l'utilisateur
    const volunteerApplication = await prisma.editionVolunteerApplication.findFirst({
      where: {
        userId: user.id,
        eventId: editionId,
        status: 'ACCEPTED',
      },
      include: {
        user: true,
      },
    })

    if (volunteerApplication) {
      // Format du QR code : `volunteer-{id}-{jeton}`. Le repli sans jeton qui vivait ici est
      // parti avec celui du contrôle d'accès : un code sans jeton n'est plus accepté au guichet,
      // et l'émettre ne ferait qu'envoyer la personne au comptoir avec un billet refusé. Même
      // règle pour les artistes et les organisateurs, plus bas.
      const qrCode = volunteerApplication.qrCodeToken
        ? `volunteer-${volunteerApplication.id}-${volunteerApplication.qrCodeToken}`
        : null

      allTickets.push({
        id: volunteerApplication.id,
        type: 'volunteer',
        firstName: volunteerApplication.user.prenom,
        lastName: volunteerApplication.user.nom,
        email: volunteerApplication.user.email,
        qrCode,
        tierName: 'Bénévole',
        amount: 0,
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
      // Même règle que pour les bénévoles : pas de jeton, pas de code.
      const qrCode = artist.qrCodeToken ? `artist-${artist.id}-${artist.qrCodeToken}` : null

      allTickets.push({
        id: artist.id,
        type: 'artist',
        firstName: artist.user.prenom,
        lastName: artist.user.nom,
        email: artist.user.email,
        qrCode,
        tierName: 'Artiste',
        amount: 0,
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
      // Même règle que pour les bénévoles : pas de jeton, pas de code.
      const qrCode = editionOrganizer.qrCodeToken
        ? `organizer-${editionOrganizer.id}-${editionOrganizer.qrCodeToken}`
        : null

      allTickets.push({
        id: editionOrganizer.id,
        type: 'organizer',
        firstName: editionOrganizer.organizer.user.prenom,
        lastName: editionOrganizer.organizer.user.nom,
        email: editionOrganizer.organizer.user.email,
        qrCode,
        tierName: 'Organisateur',
        amount: 0,
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
