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
    const granularityParam = query.granularity ? parseInt(query.granularity as string) : 60
    const validGranularities = [30, 60, 120, 360] // 30min, 1h, 2h, 6h
    const granularity = validGranularities.includes(granularityParam) ? granularityParam : 60

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

    // Déterminer la période couverte
    const setupStart = edition.volunteersSetupStartDate
      ? new Date(edition.volunteersSetupStartDate)
      : edition.startDate
    const teardownEndDate = edition.volunteersTeardownEndDate || edition.endDate
    // Aller jusqu'à la fin de la journée de démontage (23h59:59)
    const teardownEnd = new Date(teardownEndDate)
    teardownEnd.setHours(23, 59, 59, 999)

    // Récupérer toutes les validations d'entrée
    const [
      participantsValidations,
      othersValidations,
      volunteersValidations,
      artistsValidations,
      organizersValidations,
    ] = await Promise.all([
      // Participants (billets avec countAsParticipant = true)
      prisma.ticketingOrderItem.findMany({
        where: {
          order: {
            editionId,
          },
          tier: {
            countAsParticipant: true,
          },
          entryValidated: true,
          entryValidatedAt: {
            not: null,
            gte: setupStart,
            lte: teardownEnd,
          },
        },
        select: {
          entryValidatedAt: true,
        },
      }),

      // Autres (billets avec countAsParticipant = false)
      prisma.ticketingOrderItem.findMany({
        where: {
          order: {
            editionId,
          },
          tier: {
            countAsParticipant: false,
          },
          entryValidated: true,
          entryValidatedAt: {
            not: null,
            gte: setupStart,
            lte: teardownEnd,
          },
        },
        select: {
          entryValidatedAt: true,
        },
      }),

      // Bénévoles
      prisma.editionVolunteerApplication.findMany({
        where: {
          editionId,
          entryValidated: true,
          entryValidatedAt: {
            not: null,
            gte: setupStart,
            lte: teardownEnd,
          },
        },
        select: {
          entryValidatedAt: true,
        },
      }),

      // Artistes
      prisma.editionArtist.findMany({
        where: {
          editionId,
          entryValidated: true,
          entryValidatedAt: {
            not: null,
            gte: setupStart,
            lte: teardownEnd,
          },
        },
        select: {
          entryValidatedAt: true,
        },
      }),

      // Organisateurs
      prisma.editionOrganizer.findMany({
        where: {
          editionId,
          entryValidated: true,
          entryValidatedAt: {
            not: null,
            gte: setupStart,
            lte: teardownEnd,
          },
        },
        select: {
          entryValidatedAt: true,
        },
      }),
    ])

    // Créer des tranches horaires selon la granularité choisie
    const startDateTime = DateTime.fromJSDate(setupStart)
    const endDateTime = DateTime.fromJSDate(teardownEnd)

    const timeSlots: Map<
      string,
      {
        participants: number
        others: number
        volunteers: number
        artists: number
        organizers: number
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
      timeSlots.set(key, { participants: 0, others: 0, volunteers: 0, artists: 0, organizers: 0 })
      current = current.plus({ minutes: granularity })
    }

    // Compter les validations par tranche horaire
    participantsValidations.forEach((v) => {
      if (v.entryValidatedAt) {
        const dt = roundToGranularity(DateTime.fromJSDate(v.entryValidatedAt))
        const key = dt.toISO()!
        const slot = timeSlots.get(key)
        if (slot) {
          slot.participants++
        }
      }
    })

    othersValidations.forEach((v) => {
      if (v.entryValidatedAt) {
        const dt = roundToGranularity(DateTime.fromJSDate(v.entryValidatedAt))
        const key = dt.toISO()!
        const slot = timeSlots.get(key)
        if (slot) {
          slot.others++
        }
      }
    })

    volunteersValidations.forEach((v) => {
      if (v.entryValidatedAt) {
        const dt = roundToGranularity(DateTime.fromJSDate(v.entryValidatedAt))
        const key = dt.toISO()!
        const slot = timeSlots.get(key)
        if (slot) {
          slot.volunteers++
        }
      }
    })

    artistsValidations.forEach((v) => {
      if (v.entryValidatedAt) {
        const dt = roundToGranularity(DateTime.fromJSDate(v.entryValidatedAt))
        const key = dt.toISO()!
        const slot = timeSlots.get(key)
        if (slot) {
          slot.artists++
        }
      }
    })

    organizersValidations.forEach((v) => {
      if (v.entryValidatedAt) {
        const dt = roundToGranularity(DateTime.fromJSDate(v.entryValidatedAt))
        const key = dt.toISO()!
        const slot = timeSlots.get(key)
        if (slot) {
          slot.organizers++
        }
      }
    })

    // Convertir en format de réponse
    const labels: string[] = []
    const timestamps: string[] = []
    const participants: number[] = []
    const others: number[] = []
    const volunteers: number[] = []
    const artists: number[] = []
    const organizers: number[] = []

    timeSlots.forEach((counts, isoKey) => {
      const dt = DateTime.fromISO(isoKey)
      // Format selon la granularité
      let label: string
      if (granularity < 60) {
        // Pour 30 min : "Lun 15/06 14h30"
        label = dt.setLocale('fr').toFormat("EEE dd/MM HH'h'mm")
      } else if (granularity >= 360) {
        // Pour 6h : "Lun 15/06 14h"
        label = dt.setLocale('fr').toFormat("EEE dd/MM HH'h'")
      } else {
        // Pour 1h et 2h : "Lun 15/06 14h"
        label = dt.setLocale('fr').toFormat("EEE dd/MM HH'h'")
      }
      labels.push(label)
      timestamps.push(isoKey)
      participants.push(counts.participants)
      others.push(counts.others)
      volunteers.push(counts.volunteers)
      artists.push(counts.artists)
      organizers.push(counts.organizers)
    })

    // Périodes pour les filtres
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

    return {
      labels,
      timestamps,
      participants,
      others,
      volunteers,
      artists,
      organizers,
      periods,
      totals: {
        participants: participants.reduce((a, b) => a + b, 0),
        others: others.reduce((a, b) => a + b, 0),
        volunteers: volunteers.reduce((a, b) => a + b, 0),
        artists: artists.reduce((a, b) => a + b, 0),
        organizers: organizers.reduce((a, b) => a + b, 0),
      },
    }
  },
  { operationName: 'GET ticketing stats validations' }
)
