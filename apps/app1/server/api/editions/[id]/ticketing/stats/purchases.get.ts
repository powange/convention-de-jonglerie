import { DateTime } from 'luxon'

/*
 * `wrapApiHandler` est importé EXPLICITEMENT, et non pris dans l'auto-import de Nitro — comme le
 * fait déjà `order-sources.get.ts`, le graphique voisin. Sans cet import, le fichier n'est pas
 * montable dans un test : « wrapApiHandler is not defined » au chargement, avant même qu'un test
 * ne s'exécute. L'auto-import n'existe qu'à l'exécution du serveur.
 */
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import {
  billetsQuiComptent,
  estUnParticipant,
  nEstPasUnParticipant,
} from '#server/utils/ticketing/billets-qui-comptent'
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
    const granularityParam = query.granularity ? parseInt(query.granularity as string) : 1440
    const validGranularities = [720, 1440, 10080, 43200] // 12h, 1 jour, 1 semaine, 1 mois (30 jours)
    const granularity = validGranularities.includes(granularityParam) ? granularityParam : 1440

    // Récupérer l'édition avec les dates
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
    })

    if (!edition) {
      throw createError({
        status: 404,
        message: 'Edition not found',
      })
    }

    /*
     * La première commande donne le début de la période affichée.
     *
     * Elle garde la seule restriction de statut, sans la règle des lignes : une commande dont tous
     * les billets seraient annulés reculerait la borne de gauche du graphique, ce qui allongerait
     * l'axe sans rien y ajouter — désagréable, mais sans conséquence sur les chiffres. Y ajouter
     * un `items: { some }` coûterait une jointure pour ce seul confort.
     */
    const firstOrder = await prisma.ticketingOrder.findFirst({
      where: {
        editionId,
        status: {
          in: ['Processed', 'Onsite'],
        },
      },
      orderBy: {
        orderDate: 'asc',
      },
      select: {
        orderDate: true,
      },
    })

    /**
     * Les tranches sont découpées à l'heure du LIEU, pas à celle de la machine.
     *
     * Le conteneur tourne en UTC : `setHours(0, 0, 0, 0)` ouvrait donc la journée à 2 h du matin
     * heure de Paris en été, et un achat passé à 0 h 30 sur place tombait dans la veille. C'est la
     * correction déjà appliquée au graphique des validations, sur le MÊME écran, et restée en
     * dehors de celui-ci — les deux courbes se lisaient côte à côte sans parler du même temps.
     */
    const zone = fuseauUtilisable(edition.timezone)

    // Déterminer la période couverte : de la première commande au dernier jour de l'événement
    const startDate = firstOrder
      ? new Date(firstOrder.orderDate)
      : new Date(edition.startDate.getTime() - 30 * 24 * 60 * 60 * 1000) // Si pas de commande, prendre 30 jours avant

    // Début de la journée et fin de la dernière journée, telles qu'on les vit SUR PLACE.
    const setupStart = DateTime.fromJSDate(startDate, { zone }).startOf('day').toJSDate()
    const teardownEnd = DateTime.fromJSDate(edition.endDate, { zone }).endOf('day').toJSDate()

    /*
     * ⚠️ DEUX DÉFAUTS CORRIGÉS ICI, et le graphique s'affichait sans rien dire dans les deux cas.
     *
     * 1. LES LIGNES N'ÉTAIENT PAS TRIÉES. Seul `order.status` était filtré : un billet ANNULÉ au
     *    sein d'une commande vivante comptait pour un achat. C'est exactement le défaut corrigé
     *    dans le graphique de provenance, sur le MÊME écran, et laissé entier dans celui-ci.
     *
     * 2. LES BILLETS SANS TARIF DISPARAISSAIENT DES DEUX GROUPES. `countAsParticipant` vit sur le
     *    TARIF, et `TicketingOrderItem.tierId` est nullable : tester `true` puis `false` ne laisse
     *    aucune place aux 47 lignes sans tarif — des billets importés qu'aucun tarif n'a
     *    rapprochés, et de la marchandise vendue au comptoir. Elles n'apparaissaient donc dans
     *    aucune des quatre courbes, tout en étant validées au guichet. `nEstPasUnParticipant` les
     *    range dans « autres », ce qu'elles sont.
     *
     * ⚠️ POURQUOI C'ÉTAIT DEVENU VISIBLE : les deux graphiques sont côte à côte sur le même écran,
     * tirés de la même base. Avant la correction de la provenance, ils étaient faux tous les deux
     * et se recoupaient ; depuis, ils ne se recoupaient plus, et rien ne disait lequel croire.
     *
     * La restriction de statut reste ajoutée à la règle commune, comme dans le graphique voisin :
     * `billetsQuiComptent` écarte `Refunded`, et l'on veut ici la liste POSITIVE `Processed` /
     * `Onsite` — plus stricte, et identique d'un graphique à l'autre.
     */
    const regleDesBillets = billetsQuiComptent(editionId)

    /** Les conditions communes aux quatre requêtes, hors provenance et hors nature du billet. */
    const commandeRetenue = (externe: boolean) => ({
      ...regleDesBillets.order,
      status: { in: ['Processed', 'Onsite'] },
      externalTicketingId: externe ? { not: null } : null,
      orderDate: { gte: setupStart, lte: teardownEnd },
    })

    /*
     * ⚠️ `nEstPasUnParticipant` PORTE UN `OR` — « pas un participant, OU pas de tarif du tout ».
     * Il est composé sous `AND` et non étalé dans le `where`, comme l'exige son commentaire : un
     * `OR` étalé à côté d'un autre `OR` en écraserait un, silencieusement. Il n'y en a pas d'autre
     * ici aujourd'hui, et c'est précisément pourquoi la règle vaut d'être suivie maintenant.
     */
    const [
      participantsItemsManual,
      participantsItemsExternal,
      othersItemsManual,
      othersItemsExternal,
    ] = await Promise.all([
      // Participants, saisis au guichet
      prisma.ticketingOrderItem.findMany({
        where: { ...regleDesBillets, order: commandeRetenue(false), ...estUnParticipant },
        select: { order: { select: { orderDate: true } } },
      }),

      // Participants, importés d'une billetterie externe
      prisma.ticketingOrderItem.findMany({
        where: { ...regleDesBillets, order: commandeRetenue(true), ...estUnParticipant },
        select: { order: { select: { orderDate: true } } },
      }),

      // Autres (dont les lignes sans tarif), saisis au guichet
      prisma.ticketingOrderItem.findMany({
        where: {
          ...regleDesBillets,
          order: commandeRetenue(false),
          AND: [nEstPasUnParticipant],
        },
        select: { order: { select: { orderDate: true } } },
      }),

      // Autres (dont les lignes sans tarif), importés d'une billetterie externe
      prisma.ticketingOrderItem.findMany({
        where: {
          ...regleDesBillets,
          order: commandeRetenue(true),
          AND: [nEstPasUnParticipant],
        },
        select: { order: { select: { orderDate: true } } },
      }),
    ])

    // Créer des tranches horaires selon la granularité choisie
    const startDateTime = DateTime.fromJSDate(setupStart, { zone })
    const endDateTime = DateTime.fromJSDate(teardownEnd, { zone })

    const timeSlots: Map<
      string,
      {
        participantsManual: number
        participantsExternal: number
        othersManual: number
        othersExternal: number
      }
    > = new Map()

    /**
     * Arrondir sur l'horloge LOCALE, et dans l'unité que la granularité DÉSIGNE.
     *
     * L'ancienne version divisait le timestamp par la granularité en millisecondes. Deux erreurs
     * s'y cumulaient : les bornes ne tombaient juste que si le décalage du lieu était un multiple
     * entier de la granularité, et les unités comptées à partir de l'époque Unix ne sont pas
     * celles que l'écran annonce. « 1 semaine » y commençait un JEUDI (le 1ᵉʳ janvier 1970 en
     * était un) sous une étiquette « Semaine du … », et « 1 mois » découpait par blocs de trente
     * jours sous une étiquette « Juin 2024 » — un bloc pouvait donc chevaucher deux mois.
     */
    const roundToGranularity = (dt: DateTime) => {
      if (granularity === 720) return dt.startOf('day').plus({ hours: dt.hour < 12 ? 0 : 12 })
      if (granularity === 1440) return dt.startOf('day')
      if (granularity === 10080) return dt.startOf('week')
      return dt.startOf('month')
    }

    /**
     * La tranche suivante, dans la même unité — et non `+ granularity` minutes.
     *
     * ⚠️ CE N'EST PAS UN DÉTAIL DE STYLE. Avancer de 1 440 minutes absolues traverse un changement
     * d'heure en décalant l'horloge locale d'une heure : la tranche initialisée vaudrait alors
     * 01:00 là où `roundToGranularity` rend 00:00 pour les achats de cette journée. Le `get` ne
     * trouverait rien, et les ventes du jour disparaîtraient du graphique SANS qu'aucune erreur ne
     * le dise — le total affiché serait simplement plus bas.
     */
    const trancheSuivante = (dt: DateTime) => {
      if (granularity === 720) return dt.plus({ hours: 12 })
      if (granularity === 1440) return dt.plus({ days: 1 })
      if (granularity === 10080) return dt.plus({ weeks: 1 })
      return dt.plus({ months: 1 })
    }

    // Initialiser toutes les tranches horaires
    let current = roundToGranularity(startDateTime)
    while (current <= endDateTime) {
      const key = current.toISO()!
      timeSlots.set(key, {
        participantsManual: 0,
        participantsExternal: 0,
        othersManual: 0,
        othersExternal: 0,
      })
      current = trancheSuivante(current)
    }

    /*
     * Compter les achats par tranche horaire — les quatre séries par le MÊME chemin.
     *
     * C'étaient quatre blocs identiques à un nom de compteur près. Le fuseau manquait aux quatre,
     * et il aurait pu n'en manquer qu'à trois : une règle de découpage recopiée quatre fois est
     * une règle qu'on corrige trois fois.
     */
    const series = [
      ['participantsManual', participantsItemsManual],
      ['participantsExternal', participantsItemsExternal],
      ['othersManual', othersItemsManual],
      ['othersExternal', othersItemsExternal],
    ] as const

    for (const [serie, items] of series) {
      for (const item of items) {
        const key = roundToGranularity(DateTime.fromJSDate(item.order.orderDate, { zone })).toISO()!
        const slot = timeSlots.get(key)
        if (slot) slot[serie]++
      }
    }

    /**
     * La réponse porte des INSTANTS, plus des libellés.
     *
     * Elle composait « Lun 15/06 » avec `setLocale('fr')` : la langue de l'écran était donc décidée
     * par le serveur, et l'heure était celle d'UTC. Un organisateur qui lit l'application en
     * anglais voyait les abscisses en français, et toujours décalées. Le client formate désormais
     * lui-même, dans sa langue et au fuseau reçu — même correction que pour le graphique des
     * validations, et pour l'écran de contrôle d'accès.
     */
    const timestamps: string[] = []
    const participantsManual: number[] = []
    const participantsExternal: number[] = []
    const othersManual: number[] = []
    const othersExternal: number[] = []

    timeSlots.forEach((counts, isoKey) => {
      timestamps.push(isoKey)
      participantsManual.push(counts.participantsManual)
      participantsExternal.push(counts.participantsExternal)
      othersManual.push(counts.othersManual)
      othersExternal.push(counts.othersExternal)
    })

    // Périodes pour les filtres (même si non utilisées dans le frontend)
    const periods = {
      setup: {
        start: setupStart.toISOString(),
        end: edition.startDate.toISOString(),
      },
      event: {
        start: edition.startDate.toISOString(),
        end: edition.endDate.toISOString(),
      },
      teardown: {
        start: edition.endDate.toISOString(),
        end: teardownEnd.toISOString(),
      },
    }

    const result = {
      timestamps,
      /** Le fuseau dans lequel les tranches ont été découpées : le client formate avec lui. */
      timezone: edition.timezone ?? null,
      participantsManual,
      participantsExternal,
      othersManual,
      othersExternal,
      periods,
      totals: {
        participantsManual: participantsManual.reduce((a, b) => a + b, 0),
        participantsExternal: participantsExternal.reduce((a, b) => a + b, 0),
        othersManual: othersManual.reduce((a, b) => a + b, 0),
        othersExternal: othersExternal.reduce((a, b) => a + b, 0),
      },
    }

    return result
  },
  { operationName: 'GET ticketing stats purchases' }
)
