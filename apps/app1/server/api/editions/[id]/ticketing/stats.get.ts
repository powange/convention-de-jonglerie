import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionDataOrAccessControl } from '#server/utils/permissions/edition-permissions'
import { billetsQuiComptent, estUnParticipant } from '#server/utils/ticketing/billets-qui-comptent'
import { compterLesParticipants } from '~~/shared/utils/participants-par-personne'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions (gestionnaires OU bénévoles en créneau actif de contrôle d'accès)
    const allowed = await canAccessEditionDataOrAccessControl(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      /*
       * Les billets qui comptent comme participants, lus UNE fois.
       *
       * Trois `count()` tenaient ce rôle. Une seule lecture les remplace parce que le contrôle
       * d'accès affiche désormais deux comptes — par billet et par personne — et que les tirer de
       * requêtes séparées les laisserait se contredire à l'écran dès qu'une validation tombe entre
       * deux : un total regroupé supérieur au total par billet se lirait comme un bug.
       *
       * Quatre colonnes par ligne, sur les seuls billets d'une édition : la charge reste celle
       * d'un des `count()` remplacés.
       */
      const billetsParticipants = await prisma.ticketingOrderItem.findMany({
        where: {
          ...billetsQuiComptent(editionId),
          ...estUnParticipant,
        },
        select: {
          firstName: true,
          lastName: true,
          entryValidated: true,
          entryValidatedAt: true,
        },
      })

      const participants = compterLesParticipants(billetsParticipants, today)
      const ticketsValidatedToday = participants.billets.validesAujourdhui
      const totalTicketsValidated = participants.billets.valides

      // Compter les validations de bénévoles (uniquement ACCEPTED et disponibles pendant l'événement)
      const volunteersValidatedToday = await prisma.editionVolunteerApplication.count({
        where: {
          eventId: editionId,
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
          eventId: editionId,
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

      // Le total de billets sort de la même lecture que les validations, ci-dessus.
      const totalTickets = participants.billets.total

      const totalVolunteers = await prisma.editionVolunteerApplication.count({
        where: {
          eventId: editionId,
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

      return createSuccessResponse({
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
          /*
           * Les mêmes participants comptés par PERSONNE : deux billets au même nom et prénom font
           * une seule personne. Le contrôle d'accès bascule d'une lecture à l'autre au clic, sans
           * nouvelle requête — d'où les deux comptes rendus ensemble.
           */
          personnesValidated: participants.personnes.valides,
          personnesValidatedToday: participants.personnes.validesAujourdhui,
          totalPersonnes: participants.personnes.total,
          totalVolunteers: totalVolunteers,
          totalArtists: totalArtists,
          totalOrganizers: totalOrganizers,
        },
      })
    } catch (error: unknown) {
      console.error('Database stats error:', error)
      throw createError({
        status: 500,
        message: 'Erreur lors de la récupération des statistiques',
      })
    }
  },
  { operationName: 'GET ticketing stats' }
)
