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

    // Déterminer la période couverte : de la première commande au dernier jour de l'événement
    const startDate = firstOrder
      ? new Date(firstOrder.orderDate)
      : new Date(edition.startDate.getTime() - 30 * 24 * 60 * 60 * 1000) // Si pas de commande, prendre 30 jours avant

    // Définir la date de début au début de la journée
    const setupStart = new Date(startDate)
    setupStart.setHours(0, 0, 0, 0)

    // Aller jusqu'à la fin de la dernière journée de l'événement (23h59:59)
    const teardownEnd = new Date(edition.endDate)
    teardownEnd.setHours(23, 59, 59, 999)

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
    const startDateTime = DateTime.fromJSDate(setupStart)
    const endDateTime = DateTime.fromJSDate(teardownEnd)

    const timeSlots: Map<
      string,
      {
        participantsManual: number
        participantsExternal: number
        othersManual: number
        othersExternal: number
      }
    > = new Map()

    // Fonction pour arrondir un DateTime selon la granularité
    const roundToGranularity = (dt: DateTime) => {
      // Convertir la granularité en millisecondes
      const granularityMs = granularity * 60 * 1000
      // Arrondir le timestamp au multiple de la granularité le plus proche (vers le bas)
      const timestamp = dt.toMillis()
      const roundedTimestamp = Math.floor(timestamp / granularityMs) * granularityMs
      return DateTime.fromMillis(roundedTimestamp, { zone: dt.zone })
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
      current = current.plus({ minutes: granularity })
    }

    // Compter les achats par tranche horaire
    participantsItemsManual.forEach((item) => {
      const dt = roundToGranularity(DateTime.fromJSDate(item.order.orderDate))
      const key = dt.toISO()!
      const slot = timeSlots.get(key)
      if (slot) {
        slot.participantsManual++
      }
    })

    participantsItemsExternal.forEach((item) => {
      const dt = roundToGranularity(DateTime.fromJSDate(item.order.orderDate))
      const key = dt.toISO()!
      const slot = timeSlots.get(key)
      if (slot) {
        slot.participantsExternal++
      }
    })

    othersItemsManual.forEach((item) => {
      const dt = roundToGranularity(DateTime.fromJSDate(item.order.orderDate))
      const key = dt.toISO()!
      const slot = timeSlots.get(key)
      if (slot) {
        slot.othersManual++
      }
    })

    othersItemsExternal.forEach((item) => {
      const dt = roundToGranularity(DateTime.fromJSDate(item.order.orderDate))
      const key = dt.toISO()!
      const slot = timeSlots.get(key)
      if (slot) {
        slot.othersExternal++
      }
    })

    // Convertir en format de réponse
    const labels: string[] = []
    const timestamps: string[] = []
    const participantsManual: number[] = []
    const participantsExternal: number[] = []
    const othersManual: number[] = []
    const othersExternal: number[] = []

    timeSlots.forEach((counts, isoKey) => {
      const dt = DateTime.fromISO(isoKey)
      // Format selon la granularité
      let label: string
      if (granularity === 720) {
        // Pour 12h : "Lun 15/06 00h" ou "Lun 15/06 12h"
        label = dt.setLocale('fr').toFormat("EEE dd/MM HH'h'")
      } else if (granularity === 1440) {
        // Pour 1 jour : "Lun 15/06"
        label = dt.setLocale('fr').toFormat('EEE dd/MM')
      } else if (granularity === 10080) {
        // Pour 1 semaine : "Semaine du 15/06"
        label = dt.setLocale('fr').toFormat("'Semaine du' dd/MM")
      } else {
        // Pour 1 mois : "Juin 2024"
        label = dt.setLocale('fr').toFormat('MMMM yyyy')
      }
      labels.push(label)
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
      labels,
      timestamps,
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
