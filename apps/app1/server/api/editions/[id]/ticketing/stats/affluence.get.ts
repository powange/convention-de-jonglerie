import { DateTime } from 'luxon'

import {
  fenetreDeLArtiste,
  fenetreDeLOrganisateur,
  fenetreDuBenevole,
  fenetreDuBillet,
  type PeriodesEdition,
} from '#server/utils/affluence-fenetres'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import {
  compterAffluence,
  sommetDeLAffluence,
  tranchesDepuisBornes,
  type ParticipantPresent,
} from '~~/shared/utils/affluence'
import { fuseauUtilisable } from '~~/shared/utils/fuseau-edition'

/**
 * L'AFFLUENCE : combien de personnes sont sur place à un instant donné.
 *
 * À ne pas confondre avec `validations.get.ts`, son voisin, qui compte les ARRIVÉES par tranche —
 * un flux. Ici c'est un stock, et deux choses le distinguent radicalement :
 *
 * 1. **Une personne compte une fois.** Un bénévole qui a aussi acheté un billet est un seul corps
 *    sur le site. Compter les entrées surévalue l'affluence de 43 % sur l'édition 1 de la base de
 *    développement — 274 entrées pour 191 personnes.
 * 2. **La courbe redescend.** Aucune sortie n'est enregistrée : le journal ne connaît que
 *    `VALIDATED` et `INVALIDATED`, et le second est une correction, pas un départ. La fin de
 *    présence vient donc d'une fenêtre DÉCLARÉE — les dates du tarif, celles du bénévole, de
 *    l'artiste, de l'organisateur. Sans elles, cette courbe ne pourrait que monter.
 */

/** 1 jour, 12 h, 6 h, 1 h, 20 min. */
const GRANULARITES = [1440, 720, 360, 60, 20] as const
const GRANULARITE_PAR_DEFAUT = 60

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })
    }

    const query = getQuery(event)
    const demandee = query.granularity ? parseInt(String(query.granularity), 10) : NaN
    const granularite = (GRANULARITES as readonly number[]).includes(demandee)
      ? demandee
      : GRANULARITE_PAR_DEFAUT

    const [eventRecord, edition] = await Promise.all([
      prisma.event.findUnique({
        where: { id: editionId },
        select: {
          startDate: true,
          endDate: true,
          volunteerSettings: { select: { setupStartDate: true, teardownEndDate: true } },
        },
      }),
      prisma.edition.findUnique({ where: { id: editionId }, select: { timezone: true } }),
    ])

    if (!eventRecord) throw createError({ status: 404, message: 'Edition not found' })

    const fuseau = fuseauUtilisable(edition?.timezone)

    const debutEvenement = eventRecord.startDate ?? new Date()
    const finEvenement = eventRecord.endDate ?? debutEvenement
    const reglages = eventRecord.volunteerSettings
    const debutMontage = reglages?.setupStartDate ?? debutEvenement
    // Jusqu'à la fin de la journée de démontage, comme le fait le graphique des arrivées.
    const finDemontage = new Date(reglages?.teardownEndDate ?? finEvenement)
    finDemontage.setHours(23, 59, 59, 999)

    const periodes: PeriodesEdition = {
      montage: debutMontage.getTime(),
      debut: debutEvenement.getTime(),
      fin: finEvenement.getTime(),
      demontage: finDemontage.getTime(),
    }

    /**
     * Le journal, du montage au démontage.
     *
     * Trié par date : on a besoin du PREMIER mouvement pour l'entrée et du DERNIER pour savoir si
     * elle tient toujours.
     */
    const mouvements = await prisma.entryValidationLog.findMany({
      where: { editionId, createdAt: { gte: debutMontage, lte: finDemontage } },
      select: { participantKind: true, participantId: true, movement: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    /**
     * Qui est effectivement entré, et quand.
     *
     * Une entrée annulée APRÈS coup ne compte pas : `INVALIDATED` est une correction de saisie, pas
     * un départ, donc la personne n'était pas là. On retient le dernier mot du journal — et
     * l'instant de la PREMIÈRE validation, qui est l'arrivée réelle.
     */
    const entrees = new Map<
      string,
      { kind: string; id: number; premiere: number; tient: boolean }
    >()

    for (const mouvement of mouvements) {
      const cle = `${mouvement.participantKind}:${mouvement.participantId}`
      const connu = entrees.get(cle)
      const valide = mouvement.movement === 'VALIDATED'

      if (!connu) {
        entrees.set(cle, {
          kind: mouvement.participantKind,
          id: mouvement.participantId,
          premiere: mouvement.createdAt.getTime(),
          tient: valide,
        })
        continue
      }

      if (valide && !connu.tient) connu.premiere = mouvement.createdAt.getTime()
      connu.tient = valide
    }

    const retenues = [...entrees.values()].filter((e) => e.tient)
    const idsPar = (kind: string) => retenues.filter((e) => e.kind === kind).map((e) => e.id)

    const [billets, benevoles, artistes, organisateurs] = await Promise.all([
      prisma.ticketingOrderItem.findMany({
        where: { id: { in: idsPar('TICKET') } },
        select: {
          id: true,
          /*
           * L'adresse du PARTICIPANT, et elle seule.
           *
           * Pas de repli sur `order.payerEmail` : c'est l'adresse de l'ACHETEUR. S'en servir
           * rapprocherait les quatre billets d'une commande familiale en une seule personne — alors
           * que ce sont quatre corps sur le site. Un billet sans adresse propre compte donc pour
           * lui-même, ce qui est la vérité la plus proche : il désigne bien quelqu'un, on ne sait
           * juste pas qui.
           *
           * `TicketingOrder` ne porte de toute façon aucun identifiant de compte — relevé par le
           * vérificateur de sélections du dépôt, qui a refusé un `TicketingOrder.userId` inexistant.
           */
          email: true,
          tier: { select: { presenceFrom: true, presenceUntil: true } },
        },
      }),
      prisma.editionVolunteerApplication.findMany({
        where: { id: { in: idsPar('VOLUNTEER') } },
        select: {
          id: true,
          user: { select: { email: true } },
          arrivalDateTime: true,
          departureDateTime: true,
          setupAvailability: true,
          eventAvailability: true,
          teardownAvailability: true,
        },
      }),
      prisma.editionArtist.findMany({
        where: { id: { in: idsPar('ARTIST') } },
        select: {
          id: true,
          user: { select: { email: true } },
          arrivalDateTime: true,
          departureDateTime: true,
        },
      }),
      prisma.editionOrganizer.findMany({
        where: { id: { in: idsPar('ORGANIZER') } },
        select: {
          id: true,
          arrivalDateTime: true,
          departureDateTime: true,
          organizer: { select: { user: { select: { email: true } } } },
        },
      }),
    ])

    /**
     * L'identité d'une personne : son ADRESSE DE COURRIEL, et rien d'autre.
     *
     * Ce n'était pas le premier choix. Une première version prenait le compte quand il existait et
     * l'adresse sinon — et elle ne dédoublonnait RIEN entre populations : `TicketingOrder` ne porte
     * aucun identifiant de compte (relevé par le vérificateur de sélections du dépôt, qui a refusé
     * un `TicketingOrder.userId` inexistant), donc un billet ne pouvait jamais rejoindre le compte
     * d'un bénévole. Deux espaces de clés ne se rapprochent pas ; il n'en faut qu'un, et l'adresse
     * est le seul que les quatre populations partagent.
     *
     * ⚠️ C'est donc une ESTIMATION, et l'écran le dit. Deux écarts, en sens contraires :
     *
     * - un billet dont l'adresse a été saisie comme celle de l'acheteur — ce que rien n'empêche, et
     *   ce que l'importation fait souvent : sur l'édition 9, 260 billets ne portent que 72 adresses
     *   distinctes. Ces billets-là se confondent, et le total SOUS-estime ;
     * - un bénévole qui achète son billet avec une autre adresse que celle de son compte ne se
     *   rapproche pas, et le total SUR-estime.
     *
     * L'adresse de la COMMANDE n'est jamais consultée, délibérément : c'est celle du payeur, et s'en
     * servir réduirait par construction toute commande familiale à une seule personne.
     *
     * Le repli technique porte un préfixe par famille : sans lui, le billet nº 42 et le bénévole
     * nº 42 se confondraient — c'est le piège relevé sur le comptage des quotas.
     */
    const identiteDuCourriel = (...candidats: (string | null | undefined)[]) => {
      for (const candidat of candidats) {
        if (candidat?.trim()) return `courriel:${candidat.trim().toLowerCase()}`
      }
      return null
    }

    const participants: ParticipantPresent[] = []
    const entreeDe = (kind: string, id: number) =>
      entrees.get(`${kind}:${id}`)?.premiere ?? periodes.debut

    for (const billet of billets) {
      participants.push({
        identite: identiteDuCourriel(billet.email) ?? `billet:${billet.id}`,
        entree: entreeDe('TICKET', billet.id),
        fenetre: fenetreDuBillet(billet.tier, periodes),
      })
    }

    for (const benevole of benevoles) {
      participants.push({
        identite: identiteDuCourriel(benevole.user?.email) ?? `benevole:${benevole.id}`,
        entree: entreeDe('VOLUNTEER', benevole.id),
        fenetre: fenetreDuBenevole(benevole, periodes, fuseau),
      })
    }

    for (const artiste of artistes) {
      participants.push({
        identite: identiteDuCourriel(artiste.user?.email) ?? `artiste:${artiste.id}`,
        entree: entreeDe('ARTIST', artiste.id),
        fenetre: fenetreDeLArtiste(artiste, periodes),
      })
    }

    for (const organisateur of organisateurs) {
      participants.push({
        identite:
          identiteDuCourriel(organisateur.organizer?.user?.email) ??
          `organisateur:${organisateur.id}`,
        entree: entreeDe('ORGANIZER', organisateur.id),
        fenetre: fenetreDeLOrganisateur(organisateur, periodes, fuseau),
      })
    }

    /**
     * Les bornes des tranches, construites avec Luxon et au fuseau de l'édition.
     *
     * Deux raisons de ne pas additionner des millisecondes : une tranche « d'un jour » doit
     * commencer à minuit SUR PLACE — c'est la correction déjà apportée au graphique des arrivées —
     * et un pas fixe dériverait d'une heure au dimanche du changement d'heure, entraînant toutes les
     * tranches suivantes.
     */
    const arrondir = (dt: DateTime) => {
      const minutes = dt.hour * 60 + dt.minute
      return dt.startOf('day').plus({ minutes: Math.floor(minutes / granularite) * granularite })
    }

    const bornes: number[] = []
    let curseur = arrondir(DateTime.fromMillis(periodes.montage, { zone: fuseau }))
    const derniere = DateTime.fromMillis(periodes.demontage, { zone: fuseau })

    // Garde-fou : une édition mal saisie — un démontage des années après l'événement — ne doit pas
    // produire des centaines de milliers de tranches et faire tomber la page.
    const PLAFOND_TRANCHES = 5000
    while (curseur <= derniere && bornes.length <= PLAFOND_TRANCHES) {
      bornes.push(curseur.toMillis())
      curseur = curseur.plus({ minutes: granularite })
    }
    // La borne de fermeture de la dernière tranche.
    bornes.push(curseur.toMillis())

    const tranches = tranchesDepuisBornes(bornes)
    const valeurs = compterAffluence(participants, tranches)
    const sommet = sommetDeLAffluence(valeurs, tranches)

    return createSuccessResponse({
      granularity: granularite,
      granularites: GRANULARITES,
      /**
       * Des INSTANTS en ISO, pas des libellés : le client formate dans SA langue et au fuseau de
       * l'édition. Même règle que le graphique des arrivées, qui composait auparavant « Lun 15/06
       * 14h » côté serveur — donc dans la langue du serveur et à l'heure d'UTC.
       */
      timestamps: tranches.map((t) => new Date(t.debut).toISOString()),
      affluence: valeurs,
      sommet: {
        valeur: sommet.valeur,
        debut: sommet.debut !== null ? new Date(sommet.debut).toISOString() : null,
      },
      /** Le nombre de personnes distinctes venues, toutes tranches confondues. */
      personnesDistinctes: new Set(participants.map((p) => p.identite)).size,
      /** Le nombre d'entrées retenues : l'écart avec le précédent est ce que le dédoublonnage retire. */
      entreesRetenues: participants.length,
    })
  },
  { operationName: 'GetTicketingAffluence' }
)
