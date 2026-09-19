import { DateTime } from 'luxon'

import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { billetsQuiComptent, estUnParticipant } from '#server/utils/ticketing/billets-qui-comptent'
import { fuseauUtilisable } from '~~/shared/utils/fuseau-edition'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    // Récupérer le paramètre de granularité (en minutes)
    const query = getQuery(event)
    const granularityParam = query.granularity ? parseInt(query.granularity as string) : 60
    const validGranularities = [30, 60, 120, 360] // 30min, 1h, 2h, 6h
    const granularity = validGranularities.includes(granularityParam) ? granularityParam : 60

    // Étape 0bis : dates de l'événement (Event) + montage/démontage (EventVolunteerSettings)
    const eventRecord = await prisma.event.findUnique({
      where: { id: editionId },
      select: {
        startDate: true,
        endDate: true,
        volunteerSettings: { select: { setupStartDate: true, teardownEndDate: true } },
      },
    })

    if (!eventRecord) {
      throw createError({
        status: 404,
        message: 'Edition not found',
      })
    }

    const evStart = eventRecord.startDate ?? new Date()
    const evEnd = eventRecord.endDate ?? evStart
    const vs = eventRecord.volunteerSettings
    // Déterminer la période couverte
    const setupStart = vs?.setupStartDate ? new Date(vs.setupStartDate) : evStart
    const teardownEndDate = vs?.teardownEndDate || evEnd
    // Aller jusqu'à la fin de la journée de démontage (23h59:59)
    const teardownEnd = new Date(teardownEndDate)
    teardownEnd.setHours(23, 59, 59, 999)

    /**
     * Les mouvements viennent du JOURNAL, et non plus de l'état courant des quatre tables.
     *
     * L'état ne porte que la dernière situation connue : une personne entrée à 14 h dont l'entrée
     * est annulée à 18 h en disparaissait complètement, alors que son arrivée avait bien eu lieu.
     * Et les annulations n'y figuraient pas du tout.
     */
    const mouvements = await prisma.entryValidationLog.findMany({
      where: { editionId, createdAt: { gte: setupStart, lte: teardownEnd } },
      select: { participantKind: true, participantId: true, movement: true, createdAt: true },
    })

    /**
     * Quels billets comptent comme des participants.
     *
     * La distinction vit sur le TARIF (`countAsParticipant`), que le journal ne porte pas : elle
     * se résout donc à la lecture. Un billet annulé depuis rejoint « autres » plutôt que de
     * disparaître — l'ancienne version l'écartait purement et simplement, ce qui revenait à nier
     * une arrivée qui a eu lieu.
     */
    const idsBillets = [
      ...new Set(
        mouvements.filter((m) => m.participantKind === 'TICKET').map((m) => m.participantId)
      ),
    ]
    const billetsParticipants = new Set(
      idsBillets.length
        ? (
            await prisma.ticketingOrderItem.findMany({
              where: {
                id: { in: idsBillets },
                ...billetsQuiComptent(editionId),
                ...estUnParticipant,
              },
              select: { id: true },
            })
          ).map((l) => l.id)
        : []
    )

    /**
     * Les tranches sont découpées à l'heure du LIEU, pas à celle de la machine.
     *
     * Le conteneur tourne en UTC : un afflux à 18 h sur place s'affichait à 16 h en été. C'est la
     * même faute que le planning des bénévoles a corrigée — une heure de convention est une heure
     * de lieu, et `DateTime.fromJSDate` sans zone retombe sur la pendule du serveur.
     */
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { timezone: true },
    })
    const zone = fuseauUtilisable(edition?.timezone)

    const startDateTime = DateTime.fromJSDate(setupStart, { zone })
    const endDateTime = DateTime.fromJSDate(teardownEnd, { zone })

    const timeSlots: Map<
      string,
      {
        participants: number
        others: number
        volunteers: number
        artists: number
        organizers: number
        cancellations: number
      }
    > = new Map()

    /**
     * Arrondir sur l'horloge LOCALE, et non sur l'instant absolu.
     *
     * L'ancienne version divisait le timestamp : les bornes tombaient juste tant que le décalage
     * était un multiple entier de la granularité, et l'étiquette restait celle d'UTC. Ici on
     * descend aux heures et minutes du lieu, ce qui donne des tranches qui commencent à des heures
     * rondes pour qui est sur place.
     */
    const roundToGranularity = (dt: DateTime) => {
      const minutes = dt.hour * 60 + dt.minute
      return dt.startOf('day').plus({ minutes: Math.floor(minutes / granularity) * granularity })
    }

    // Initialiser toutes les tranches horaires
    let current = roundToGranularity(startDateTime)
    while (current <= endDateTime) {
      const key = current.toISO()!
      timeSlots.set(key, {
        participants: 0,
        others: 0,
        volunteers: 0,
        artists: 0,
        organizers: 0,
        cancellations: 0,
      })
      current = current.plus({ minutes: granularity })
    }

    // Compter les mouvements par tranche horaire.
    //
    // Les ANNULATIONS forment leur propre série : elles ne se retranchent pas des arrivées. Une
    // arrivée a eu lieu, même si l'entrée a été retirée ensuite — et sur les éditions antérieures
    // au 19/09/2026, la reprise n'a reconstitué aucune annulation : une courbe qui les
    // soustrairait y serait fausse sans que rien ne le signale.
    mouvements.forEach((mouvement) => {
      const cle = roundToGranularity(DateTime.fromJSDate(mouvement.createdAt, { zone })).toISO()!
      const tranche = timeSlots.get(cle)
      if (!tranche) return

      if (mouvement.movement === 'INVALIDATED') {
        tranche.cancellations++
        return
      }

      if (mouvement.participantKind === 'VOLUNTEER') tranche.volunteers++
      else if (mouvement.participantKind === 'ARTIST') tranche.artists++
      else if (mouvement.participantKind === 'ORGANIZER') tranche.organizers++
      else if (billetsParticipants.has(mouvement.participantId)) tranche.participants++
      else tranche.others++
    })

    /**
     * La réponse porte des INSTANTS, plus des libellés.
     *
     * Elle composait « Lun 15/06 14h » avec `setLocale('fr')` : la langue de l'écran était donc
     * décidée par le serveur, et l'heure était celle d'UTC. Le client formate désormais lui-même,
     * dans sa langue et au fuseau de l'édition — même correction que pour l'écran de contrôle
     * d'accès.
     */
    const timestamps: string[] = []
    const participants: number[] = []
    const others: number[] = []
    const volunteers: number[] = []
    const artists: number[] = []
    const organizers: number[] = []
    const cancellations: number[] = []

    timeSlots.forEach((counts, isoKey) => {
      timestamps.push(isoKey)
      participants.push(counts.participants)
      others.push(counts.others)
      volunteers.push(counts.volunteers)
      artists.push(counts.artists)
      organizers.push(counts.organizers)
      cancellations.push(counts.cancellations)
    })

    // Périodes pour les filtres (Étape 0bis : dates portées par l'Event, via evStart/evEnd ;
    // l'ancienne variable `edition` n'existe plus dans ce handler).
    const periods = {
      setup: {
        start: setupStart.toISOString(),
        end: evStart.toISOString(),
      },
      event: {
        start: evStart.toISOString(),
        end: evEnd.toISOString(),
      },
      teardown: {
        start: evEnd.toISOString(),
        end: teardownEnd.toISOString(),
      },
    }

    return {
      timestamps,
      /** Le fuseau dans lequel les tranches ont été découpées : le client formate avec lui. */
      timezone: edition?.timezone ?? null,
      participants,
      others,
      volunteers,
      artists,
      organizers,
      cancellations,
      periods,
      totals: {
        participants: participants.reduce((a, b) => a + b, 0),
        others: others.reduce((a, b) => a + b, 0),
        volunteers: volunteers.reduce((a, b) => a + b, 0),
        artists: artists.reduce((a, b) => a + b, 0),
        organizers: organizers.reduce((a, b) => a + b, 0),
        cancellations: cancellations.reduce((a, b) => a + b, 0),
      },
    }
  },
  { operationName: 'GET ticketing stats validations' }
)
