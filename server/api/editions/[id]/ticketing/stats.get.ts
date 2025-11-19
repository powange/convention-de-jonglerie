import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

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

      // Compter les validations de billets (uniquement les tarifs avec countAsParticipant = true)
      const ticketsValidatedToday = await prisma.ticketingOrderItem.count({
        where: {
          state: { in: ['Processed', 'Pending'] }, // Exclure les billets remboursés
          order: {
            editionId: editionId,
          },
          tier: {
            countAsParticipant: true,
          },
          entryValidated: true,
          entryValidatedAt: {
            gte: today,
          },
        },
      })

      const totalTicketsValidated = await prisma.ticketingOrderItem.count({
        where: {
          state: { in: ['Processed', 'Pending'] }, // Exclure les billets remboursés
          order: {
            editionId: editionId,
          },
          tier: {
            countAsParticipant: true,
          },
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

      // Compter les validations d'organisateurs
      const organizersValidatedToday = await prisma.editionOrganizer.count({
        where: {
          editionId: editionId,
          entryValidated: true,
          entryValidatedAt: {
            gte: today,
          },
        },
      })

      const totalOrganizersValidated = await prisma.editionOrganizer.count({
        where: {
          editionId: editionId,
          entryValidated: true,
        },
      })

      // Compter le nombre total de billets (uniquement les tarifs avec countAsParticipant = true)
      const totalTickets = await prisma.ticketingOrderItem.count({
        where: {
          state: { in: ['Processed', 'Pending'] }, // Exclure les billets remboursés
          order: {
            editionId: editionId,
          },
          tier: {
            countAsParticipant: true,
          },
        },
      })

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

      // Compter le nombre total d'organisateurs de l'édition
      const totalOrganizers = await prisma.editionOrganizer.count({
        where: {
          editionId: editionId,
        },
      })

      return {
        success: true,
        stats: {
          validatedToday:
            ticketsValidatedToday +
            volunteersValidatedToday +
            artistsValidatedToday +
            organizersValidatedToday,
          totalValidated:
            totalTicketsValidated +
            totalVolunteersValidated +
            totalArtistsValidated +
            totalOrganizersValidated,
          ticketsValidated: totalTicketsValidated,
          volunteersValidated: totalVolunteersValidated,
          artistsValidated: totalArtistsValidated,
          organizersValidated: totalOrganizersValidated,
          ticketsValidatedToday: ticketsValidatedToday,
          volunteersValidatedToday: volunteersValidatedToday,
          artistsValidatedToday: artistsValidatedToday,
          organizersValidatedToday: organizersValidatedToday,
          totalTickets: totalTickets,
          totalVolunteers: totalVolunteers,
          totalArtists: totalArtists,
          totalOrganizers: totalOrganizers,
        },
      }
    } catch (error: unknown) {
      console.error('Database stats error:', error)
      throw createError({
        statusCode: 500,
        message: 'Erreur lors de la récupération des statistiques',
      })
    }
  },
  { operationName: 'GET ticketing stats' }
)
