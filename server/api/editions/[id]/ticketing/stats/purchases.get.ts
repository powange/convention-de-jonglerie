import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { DateTime } from 'luxon'

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
        statusCode: 404,
        message: 'Edition not found',
      })
    }

    // Trouver la date de la première commande pour cette édition
    // Statuts valides : Processed (payé via HelloAsso) et Onsite (ajouté manuellement sur place)
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

    // Log pour debug
    console.log('[DEBUG purchases.get] Edition:', editionId)
    console.log('[DEBUG purchases.get] Date range:', setupStart, '-', teardownEnd)
    console.log('[DEBUG purchases.get] Granularity:', granularity)

    // Récupérer tous les achats (items de commandes payées)
    const [
      participantsItemsManual,
      participantsItemsExternal,
      othersItemsManual,
      othersItemsExternal,
    ] = await Promise.all([
      // Participants manuels (billets avec countAsParticipant = true et commande manuelle)
      prisma.ticketingOrderItem.findMany({
        where: {
          order: {
            editionId,
            status: {
              in: ['Processed', 'Onsite'],
            },
            externalTicketingId: null, // Commandes manuelles
            orderDate: {
              gte: setupStart,
              lte: teardownEnd,
            },
          },
          tier: {
            countAsParticipant: true,
          },
        },
        select: {
          order: {
            select: {
              orderDate: true,
            },
          },
        },
      }),

      // Participants externes (billets avec countAsParticipant = true et commande externe)
      prisma.ticketingOrderItem.findMany({
        where: {
          order: {
            editionId,
            status: {
              in: ['Processed', 'Onsite'],
            },
            externalTicketingId: { not: null }, // Commandes externes (HelloAsso, etc.)
            orderDate: {
              gte: setupStart,
              lte: teardownEnd,
            },
          },
          tier: {
            countAsParticipant: true,
          },
        },
        select: {
          order: {
            select: {
              orderDate: true,
            },
          },
        },
      }),

      // Autres manuels (billets avec countAsParticipant = false et commande manuelle)
      prisma.ticketingOrderItem.findMany({
        where: {
          order: {
            editionId,
            status: {
              in: ['Processed', 'Onsite'],
            },
            externalTicketingId: null,
            orderDate: {
              gte: setupStart,
              lte: teardownEnd,
            },
          },
          tier: {
            countAsParticipant: false,
          },
        },
        select: {
          order: {
            select: {
              orderDate: true,
            },
          },
        },
      }),

      // Autres externes (billets avec countAsParticipant = false et commande externe)
      prisma.ticketingOrderItem.findMany({
        where: {
          order: {
            editionId,
            status: {
              in: ['Processed', 'Onsite'],
            },
            externalTicketingId: { not: null },
            orderDate: {
              gte: setupStart,
              lte: teardownEnd,
            },
          },
          tier: {
            countAsParticipant: false,
          },
        },
        select: {
          order: {
            select: {
              orderDate: true,
            },
          },
        },
      }),
    ])

    // Log les résultats
    console.log('[DEBUG purchases.get] Items trouvés:')
    console.log('  - participantsItemsManual:', participantsItemsManual.length)
    console.log('  - participantsItemsExternal:', participantsItemsExternal.length)
    console.log('  - othersItemsManual:', othersItemsManual.length)
    console.log('  - othersItemsExternal:', othersItemsExternal.length)

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

    console.log('[DEBUG purchases.get] Totaux:', result.totals)
    console.log('[DEBUG purchases.get] Nombre de labels:', result.labels.length)

    return result
  },
  { operationName: 'GET ticketing stats purchases' }
)
