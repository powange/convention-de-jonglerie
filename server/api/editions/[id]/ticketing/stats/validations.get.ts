import { canManageTicketing } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { DateTime } from 'luxon'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const user = session.user
  const editionId = parseInt(getRouterParam(event, 'id') || '0')

  if (!editionId || isNaN(editionId)) {
    throw createError({
      statusCode: 400,
      message: "ID d'édition invalide",
    })
  }

  // Récupérer l'édition avec les dates
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      convention: {
        include: {
          organizers: {
            where: {
              userId: user.id,
            },
          },
        },
      },
      organizerPermissions: {
        where: {
          organizer: {
            userId: user.id,
          },
        },
        include: {
          organizer: {
            select: {
              userId: true,
            },
          },
        },
      },
    },
  })

  if (!edition) {
    throw createError({
      statusCode: 404,
      message: 'Edition not found',
    })
  }

  // Vérifier les permissions
  if (!canManageTicketing(edition, user)) {
    throw createError({
      statusCode: 403,
      message: "Vous n'avez pas les droits pour consulter ces statistiques",
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
  const [participantsValidations, othersValidations, volunteersValidations, artistsValidations] =
    await Promise.all([
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
    ])

  // Créer des tranches horaires de 1 heure
  const startDateTime = DateTime.fromJSDate(setupStart)
  const endDateTime = DateTime.fromJSDate(teardownEnd)

  const hourSlots: Map<
    string,
    { participants: number; others: number; volunteers: number; artists: number }
  > = new Map()

  // Initialiser toutes les tranches horaires
  let current = startDateTime.startOf('hour')
  while (current <= endDateTime) {
    const key = current.toISO()!
    hourSlots.set(key, { participants: 0, others: 0, volunteers: 0, artists: 0 })
    current = current.plus({ hours: 1 })
  }

  // Compter les validations par tranche horaire
  participantsValidations.forEach((v) => {
    if (v.entryValidatedAt) {
      const dt = DateTime.fromJSDate(v.entryValidatedAt).startOf('hour')
      const key = dt.toISO()!
      const slot = hourSlots.get(key)
      if (slot) {
        slot.participants++
      }
    }
  })

  othersValidations.forEach((v) => {
    if (v.entryValidatedAt) {
      const dt = DateTime.fromJSDate(v.entryValidatedAt).startOf('hour')
      const key = dt.toISO()!
      const slot = hourSlots.get(key)
      if (slot) {
        slot.others++
      }
    }
  })

  volunteersValidations.forEach((v) => {
    if (v.entryValidatedAt) {
      const dt = DateTime.fromJSDate(v.entryValidatedAt).startOf('hour')
      const key = dt.toISO()!
      const slot = hourSlots.get(key)
      if (slot) {
        slot.volunteers++
      }
    }
  })

  artistsValidations.forEach((v) => {
    if (v.entryValidatedAt) {
      const dt = DateTime.fromJSDate(v.entryValidatedAt).startOf('hour')
      const key = dt.toISO()!
      const slot = hourSlots.get(key)
      if (slot) {
        slot.artists++
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

  hourSlots.forEach((counts, isoKey) => {
    const dt = DateTime.fromISO(isoKey)
    // Format: "Lun 15/06 14h"
    const label = dt.setLocale('fr').toFormat("EEE dd/MM HH'h'")
    labels.push(label)
    timestamps.push(isoKey)
    participants.push(counts.participants)
    others.push(counts.others)
    volunteers.push(counts.volunteers)
    artists.push(counts.artists)
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
    periods,
    totals: {
      participants: participants.reduce((a, b) => a + b, 0),
      others: others.reduce((a, b) => a + b, 0),
      volunteers: volunteers.reduce((a, b) => a + b, 0),
      artists: artists.reduce((a, b) => a + b, 0),
    },
  }
})
