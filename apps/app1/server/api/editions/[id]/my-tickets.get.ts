import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { userWithNameSelect } from '#server/utils/prisma-select-helpers'
import { benevoleAccepteEtPresentSurPlace } from '#server/utils/ticketing/benevoles-presents'
import { estUnBilletAnnule } from '#server/utils/ticketing/billets-qui-comptent'
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
        /*
         * ⚠️ ANNONCÉ, PAS MASQUÉ — constat B8.
         *
         * Un billet annulé chez HelloAsso, ou dont la commande a été remboursée, apparaissait
         * ici comme n'importe quel autre : avec son code QR, et sans un mot. Au guichet, ce
         * même billet est REFUSÉ par `billetAnnule()`. Le participant découvrait l'annulation
         * **devant la file**.
         *
         * Le filtrer aurait été pire : le billet disparaîtrait de « Mes billets » sans
         * explication, et la personne croirait n'en avoir jamais eu. On le garde, et on le DIT.
         *
         * Le vocabulaire est celui du guichet, par le même util : les deux surfaces répondaient
         * à la même question en se contredisant.
         */
        annule: estUnBilletAnnule(ticket, ticket.order),
      }))
    )

    /*
     * ⚠️ « ACCEPTÉ » NE SUFFIT PAS : il faut aussi être PRÉSENT pendant l'événement.
     *
     * Ce `where` ne portait que `status: 'ACCEPTED'`. Un bénévole qui a explicitement répondu
     * qu'il n'était pas là pendant l'événement — montage seul, démontage seul — recevait donc un
     * badge, avec son QR code, dans « mes billets ». Et le guichet le REFUSAIT au scan, puisque
     * `ticketing/verify.post.ts` applique bien la condition.
     *
     * Les deux surfaces répondaient à la même question et se contredisaient : la personne se
     * présente avec un billet que l'application lui a donné, et s'entend dire qu'il n'est pas
     * valable.
     *
     * La règle vit désormais dans un util partagé — elle était recopiée quatre fois ailleurs.
     */
    const volunteerApplication = await prisma.editionVolunteerApplication.findFirst({
      where: {
        userId: user.id,
        ...benevoleAccepteEtPresentSurPlace(editionId),
      },
      include: {
        /*
         * ⚠️ UN `select` ET NON `user: true`. L'include ramenait toute la ligne `User` — mot de
         * passe compris — alors que la réponse n'en reprend que le prénom, le nom et l'adresse,
         * recomposés à la main plus bas. Le `CLAUDE.md` impose d'ailleurs les aides du dépôt, et
         * d'étendre par spread quand il manque un champ : `userWithNameSelect` n'a pas `email`.
         */
        user: { select: { ...userWithNameSelect, email: true } },
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
        /*
         * ⚠️ UN `select` ET NON `user: true`. L'include ramenait toute la ligne `User` — mot de
         * passe compris — alors que la réponse n'en reprend que le prénom, le nom et l'adresse,
         * recomposés à la main plus bas. Le `CLAUDE.md` impose d'ailleurs les aides du dépôt, et
         * d'étendre par spread quand il manque un champ : `userWithNameSelect` n'a pas `email`.
         */
        user: { select: { ...userWithNameSelect, email: true } },
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
            // Même raison qu'au-dessus, un niveau plus bas.
            user: { select: { ...userWithNameSelect, email: true } },
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
