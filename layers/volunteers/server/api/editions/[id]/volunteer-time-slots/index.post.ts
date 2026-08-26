import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'
import {
  genererCreneauxRecurrents,
  type EtendueRecurrence,
} from '~~/shared/utils/creneaux-recurrents'

const createTimeSlotSchema = z
  .object({
    title: z.string().max(200).nullable(),
    description: z.string().optional(),
    teamId: z.string().optional(),
    startDateTime: z.string().transform((str) => new Date(str)),
    endDateTime: z.string().transform((str) => new Date(str)),
    maxVolunteers: z.number().int().min(1).max(50),
    /**
     * Répète le créneau sur chaque journée de la période, aux mêmes heures.
     *
     * Raccourci de saisie seulement : les créneaux produits sont autonomes, rien ne les relie
     * ensuite. En modifier un ou le supprimer n'affecte pas les autres.
     */
    recurrence: z.enum(['AUCUNE', 'EVENEMENT', 'AVEC_MONTAGE']).optional().default('AUCUNE'),
  })
  .refine((data) => data.endDateTime > data.startDateTime, {
    message: 'La date de fin doit être postérieure à la date de début',
    path: ['endDateTime'],
  })

/** Ce que le calendrier attend d'un créneau : FullCalendar lit `start`, `end` et `resourceId`. */
const formaterPourCalendrier = (slot: {
  id: string
  title: string | null
  description: string | null
  startDateTime: Date
  endDateTime: Date
  teamId: string | null
  team: { id: string; name: string; color: string } | null
  maxVolunteers: number
  assignments: unknown[]
  _count: { assignments: number }
}) => ({
  id: slot.id,
  title: slot.title,
  description: slot.description,
  start: slot.startDateTime.toISOString(),
  end: slot.endDateTime.toISOString(),
  teamId: slot.teamId,
  team: slot.team,
  maxVolunteers: slot.maxVolunteers,
  assignedVolunteers: slot._count.assignments,
  assignments: slot.assignments,
  color: slot.team?.color || '#6b7280',
  resourceId: slot.teamId || 'unassigned',
})

const inclusionCreneau = {
  team: { select: { id: true, name: true, color: true } },
  assignments: {
    include: {
      user: { select: { id: true, pseudo: true, nom: true, prenom: true } },
    },
  },
  _count: { select: { assignments: true } },
} as const

export default wrapApiHandler(
  async (event) => {
    // Authentification requise
    await requireAuth(event)

    // Validation des paramètres
    const editionId = validateEditionId(event)

    // Vérifier les permissions de gestion des bénévoles
    await useVolunteerPorts().organizers.requireManagementAccess(event, editionId)

    // Validation du body
    const body = await readValidatedBody(event, createTimeSlotSchema.parse)

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
        message: 'Édition non trouvée',
      })
    }

    // Vérifier que l'équipe existe (si spécifiée)
    if (body.teamId) {
      const team = await prisma.volunteerTeam.findFirst({
        where: {
          id: body.teamId,
          eventId: editionId,
        },
      })

      if (!team) {
        throw createError({
          status: 400,
          message: "Équipe non trouvée ou n'appartient pas à cette édition",
        })
      }
    }

    // Vérifier que les dates sont dans la période de l'édition (incluant montage/démontage)
    // Utilise les dates de montage/démontage si définies, sinon les dates de l'édition
    const evStart = eventRecord.startDate ?? new Date()
    const evEnd = eventRecord.endDate ?? evStart
    const s = eventRecord.volunteerSettings
    const editionStart = s?.setupStartDate ? new Date(s.setupStartDate) : new Date(evStart)
    const editionEnd = s?.teardownEndDate ? new Date(s.teardownEndDate) : new Date(evEnd)

    // Ajouter un jour à la date de fin pour inclure tout le dernier jour (jusqu'à 23:59:59)
    editionEnd.setDate(editionEnd.getDate() + 1)

    if (body.startDateTime < editionStart || body.endDateTime > editionEnd) {
      throw createError({
        status: 400,
        message: "Le créneau doit être dans la période de l'édition",
      })
    }

    /**
     * Créneaux à écrire : le seul saisi, ou toute sa répétition.
     *
     * Les répétitions ne repassent pas par le contrôle de période ci-dessus : un créneau de nuit
     * déborde sur le lendemain, y compris le dernier soir, et c'est voulu — la dernière soirée
     * se termine comme les autres.
     */
    let creneaux = [{ startDateTime: body.startDateTime, endDateTime: body.endDateTime }]

    if (body.recurrence !== 'AUCUNE') {
      // Le fuseau de l'édition ancre les heures murales : sans lui, un changement d'heure au
      // milieu de la convention décalerait les créneaux suivants.
      const edition = await prisma.edition.findUnique({
        where: { id: editionId },
        select: { timezone: true },
      })

      const repetitions = genererCreneauxRecurrents(
        { startDateTime: body.startDateTime, endDateTime: body.endDateTime },
        body.recurrence as EtendueRecurrence,
        {
          debutEvenement: evStart,
          finEvenement: evEnd,
          debutMontage: s?.setupStartDate,
          finDemontage: s?.teardownEndDate,
        },
        edition?.timezone
      )

      // Une génération vide — bornes ou fuseau illisibles — ne doit pas faire disparaître le
      // créneau que l'organisateur vient de saisir.
      if (repetitions.length > 0) {
        creneaux = repetitions.map((c) => ({
          startDateTime: new Date(c.startDateTime),
          endDateTime: new Date(c.endDateTime),
        }))
      }
    }

    // Une transaction : une répétition à moitié écrite laisserait un planning incohérent que
    // l'organisateur devrait démêler à la main.
    const timeSlots = await prisma.$transaction(
      creneaux.map((c) =>
        prisma.volunteerTimeSlot.create({
          data: {
            eventId: editionId,
            teamId: body.teamId || null,
            title: body.title,
            description: body.description,
            startDateTime: c.startDateTime,
            endDateTime: c.endDateTime,
            maxVolunteers: body.maxVolunteers,
          },
          include: inclusionCreneau,
        })
      )
    )

    setResponseStatus(event, 201)
    return createSuccessResponse({
      timeSlots: timeSlots.map(formaterPourCalendrier),
    })
  },
  { operationName: 'CreateVolunteerTimeSlot' }
)
