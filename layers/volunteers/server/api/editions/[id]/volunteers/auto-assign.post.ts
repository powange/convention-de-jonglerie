import { z } from 'zod'

import type { PrismaTransaction, AutoAssignmentResult } from '#server/types/prisma-helpers'
import type { Prisma } from '@prisma/client'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { userWithNameSelect } from '#server/utils/prisma-select-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { VolunteerScheduler } from '#server/utils/volunteer-scheduler'
import { useVolunteerPorts } from '#server/volunteers/ports/registry'

// Types pour les données récupérées de la base de données
type VolunteerWithTeamAssignments = Prisma.EditionVolunteerApplicationGetPayload<{
  include: {
    user: { select: typeof userWithNameSelect }
    teamAssignments: { include: { team: true } }
  }
}>

type TimeSlotWithAssignments = Prisma.VolunteerTimeSlotGetPayload<{
  include: {
    assignments: { include: { user: true } }
  }
}>

type Team = Prisma.VolunteerTeamGetPayload<object>

// Schéma de validation pour les contraintes
const constraintsSchema = z.object({
  maxHoursPerVolunteer: z.number().min(1).max(24).optional(),
  minHoursPerVolunteer: z.number().min(0).max(12).optional(),
  maxHoursPerDay: z.number().min(1).max(12).optional(),
  minHoursPerDay: z.number().min(0).max(8).optional(),
  balanceTeams: z.boolean().optional(),
  prioritizeExperience: z.boolean().optional(),
  respectStrictAvailability: z.boolean().optional(),
  respectStrictTeamPreferences: z.boolean().optional(),
  respectStrictAssignedTeams: z.boolean().optional(),
  preserverAccesSpectacles: z.boolean().optional(),
  respectStrictTimePreferences: z.boolean().optional(),
  allowOvertime: z.boolean().optional(),
  maxOvertimeHours: z.number().min(0).max(6).optional(),
  keepExistingAssignments: z.boolean().optional(),
  /**
   * Sort réservé aux affectations déjà en place :
   * - `replace-all`  : tout effacer avant de recalculer (comportement historique)
   * - `keep-all`     : ne rien effacer, ne combler que les places libres
   * - `keep-manual`  : effacer ce que l'algorithme avait posé, garder les choix humains
   *
   * L'ancien booléen reste accepté et se traduit dans ces modes, pour qu'un appel écrit
   * avant cette évolution continue de fonctionner.
   */
  existingAssignmentsMode: z.enum(['replace-all', 'keep-all', 'keep-manual']).optional(),
})

export default wrapApiHandler(async (event) => {
  // Vérification de l'authentification
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  // Étape 0bis : vérif d'existence sur l'Event (les permissions passent par le port organizer).
  // Les dates de l'événement séparent le montage de l'événement et l'événement du démontage :
  // le planificateur en a besoin pour classer chaque créneau sans se fier à son titre.
  const eventRecord = await prisma.event.findUnique({
    where: { id: editionId },
    select: { id: true, startDate: true, endDate: true },
  })

  if (!eventRecord) {
    throw createError({
      status: 404,
      statusText: 'Édition non trouvée',
    })
  }

  if (!(await useVolunteerPorts().organizers.canManage(editionId, user.id, event))) {
    throw createError({
      status: 403,
      statusText: 'Droits insuffisants pour gérer les bénévoles',
    })
  }

  // Lecture et validation du body
  const body = await readBody(event)
  const constraints = constraintsSchema.parse(body.constraints || {})

  // Récupération des données nécessaires
  const [volunteers, timeSlots, teams, spectacles] = await Promise.all([
    // Bénévoles acceptés
    prisma.editionVolunteerApplication.findMany({
      where: {
        eventId: editionId,
        status: 'ACCEPTED',
      },
      include: {
        user: {
          select: userWithNameSelect,
        },
        teamAssignments: {
          include: {
            team: true,
          },
        },
      },
    }),

    // Créneaux horaires
    prisma.volunteerTimeSlot.findMany({
      where: { eventId: editionId },
      include: {
        assignments: {
          include: {
            user: true,
          },
        },
      },
    }),

    // Équipes
    prisma.volunteerTeam.findMany({
      where: { eventId: editionId },
    }),

    // Programmation des spectacles : l'algorithme refuse de priver un bénévole du dernier
    // passage de l'un d'eux. Le layer ne connaît pas la notion de spectacle, d'où le port.
    useVolunteerPorts().artists.getShowSchedule(editionId),
  ])

  const mode =
    constraints.existingAssignmentsMode ??
    (constraints.keepExistingAssignments ? 'keep-all' : 'replace-all')

  /** Une affectation survit-elle au recalcul ? */
  const conservee = (assignment: { source?: string }) =>
    mode === 'keep-all' || (mode === 'keep-manual' && assignment.source !== 'AUTO')

  // Les bénévoles dont une affectation subsiste occupent déjà leur place : les proposer à
  // nouveau les ferait compter deux fois.
  let availableVolunteers = volunteers
  if (mode !== 'replace-all') {
    const assignedVolunteerIds = new Set(
      timeSlots.flatMap((slot: TimeSlotWithAssignments) =>
        slot.assignments.filter(conservee).map((assignment) => assignment.user.id)
      )
    )
    availableVolunteers = volunteers.filter(
      (volunteer: VolunteerWithTeamAssignments) => !assignedVolunteerIds.has(volunteer.user.id)
    )
  }

  // Conversion des données pour l'algorithme
  const schedulerVolunteers = availableVolunteers.map(
    (volunteer: VolunteerWithTeamAssignments) => ({
      id: volunteer.id,
      user: volunteer.user,
      availability: JSON.stringify({
        setup: volunteer.setupAvailability || false,
        teardown: volunteer.teardownAvailability || false,
        event: volunteer.eventAvailability || false,
        timePreferences: volunteer.timePreferences || null,
      }),
      experience: volunteer.hasExperience
        ? volunteer.experienceDetails || 'Expérience confirmée'
        : '',
      motivation: volunteer.motivation || '',
      phone: volunteer.userSnapshotPhone,
      teamPreferences: volunteer.teamPreferences
        ? Array.isArray(volunteer.teamPreferences)
          ? volunteer.teamPreferences
          : []
        : [],
      // Les équipes où les organisateurs ont déjà placé ce bénévole, sous la même forme que
      // les préférences : des identifiants d'équipe, comparables au `teamId` d'un créneau.
      assignedTeams: volunteer.teamAssignments.map((assignation) => assignation.teamId),
    })
  )

  const schedulerTimeSlots = timeSlots.map((slot: TimeSlotWithAssignments) => ({
    id: slot.id.toString(),
    title: slot.title || 'Créneau sans titre',
    start: slot.startDateTime.toISOString(),
    end: slot.endDateTime.toISOString(),
    teamId: slot.teamId?.toString() || undefined,
    maxVolunteers: slot.maxVolunteers,
    // Seules les affectations qui survivent occupent une place
    assignedVolunteers: slot.assignments.filter(conservee).length,
    description: slot.description || undefined,
  }))

  const schedulerTeams = teams.map((team: Team) => ({
    id: team.id,
    name: team.name,
    color: team.color,
  }))

  // Exécution de l'algorithme
  const scheduler = new VolunteerScheduler(
    schedulerVolunteers,
    schedulerTimeSlots,
    schedulerTeams,
    constraints,
    {
      debut: eventRecord.startDate?.toISOString() ?? null,
      fin: eventRecord.endDate?.toISOString() ?? null,
    },
    spectacles
  )

  const result = scheduler.assignVolunteers()

  // Application des assignations en base de données si demandé
  if (body.applyAssignments === true) {
    await applyAssignments(editionId, result.assignments, user.id, mode)
  }

  return createSuccessResponse({
    result,
    preview: body.applyAssignments !== true, // Indique si c'est un aperçu ou une application
  })
}, 'AutoAssignVolunteers')

/**
 * Applique les assignations en base de données
 */
async function applyAssignments(
  editionId: number,
  assignments: AutoAssignmentResult[],
  userId: number,
  mode: 'replace-all' | 'keep-all' | 'keep-manual'
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 1. Effacer ce que le mode ne conserve pas. En `keep-manual`, seules les affectations
    //    posées par un précédent calcul disparaissent : les choix humains restent.
    if (mode !== 'keep-all') {
      await tx.volunteerAssignment.deleteMany({
        where: {
          timeSlot: { eventId: editionId },
          ...(mode === 'keep-manual' ? { source: 'AUTO' } : {}),
        },
      })
    }

    // 2. Créer les nouvelles assignations aux créneaux
    for (const assignment of assignments) {
      // Une affectation conservée peut déjà exister : la recréer violerait l'unicité
      if (mode !== 'replace-all') {
        const existing = await tx.volunteerAssignment.findFirst({
          where: {
            timeSlotId: assignment.slotId,
            userId: assignment.volunteerId,
          },
        })
        if (existing) continue // Passer si l'assignation existe déjà
      }

      await tx.volunteerAssignment.create({
        data: {
          timeSlotId: assignment.slotId,
          userId: assignment.volunteerId,
          assignedById: userId,
          assignedAt: new Date(),
          source: 'AUTO',
        },
      })
    }

    // 3. Assigner les bénévoles aux équipes correspondantes
    await assignVolunteersToTeams(tx, editionId, assignments, mode)

    // 4. Log de l'action
    console.log(
      `Auto-assignation appliquée pour l'édition ${editionId} par l'utilisateur ${userId}`
    )
    console.log(`${assignments.length} assignations créées`)
  })
}

/**
 * Assigne les bénévoles aux équipes correspondantes à leurs créneaux
 */
async function assignVolunteersToTeams(
  tx: PrismaTransaction,
  editionId: number,
  assignments: AutoAssignmentResult[],
  mode: 'replace-all' | 'keep-all' | 'keep-manual'
): Promise<void> {
  // Grouper les assignations par bénévole
  const volunteerTeams = new Map<number, Set<string>>()

  for (const assignment of assignments) {
    if (assignment.teamId) {
      if (!volunteerTeams.has(assignment.volunteerId)) {
        volunteerTeams.set(assignment.volunteerId, new Set())
      }
      volunteerTeams.get(assignment.volunteerId)!.add(assignment.teamId)
    }
  }

  // Pour chaque bénévole, mettre à jour ses équipes assignées
  for (const [volunteerId, teamIds] of volunteerTeams) {
    // Récupérer l'application du bénévole
    const application = await tx.editionVolunteerApplication.findUnique({
      where: {
        eventId_userId: {
          eventId: editionId,
          userId: volunteerId,
        },
      },
      include: {
        teamAssignments: {
          include: {
            team: true,
          },
        },
      },
    })

    if (!application) continue

    // L'appartenance à une équipe n'a pas d'origine enregistrée, contrairement à
    // l'affectation à un créneau : on ne l'efface donc qu'en mode « tout effacer ».
    // La supprimer en mode « garder le manuel » détruirait des choix humains, ce que ce
    // mode existe précisément pour éviter.
    if (mode === 'replace-all') {
      await tx.applicationTeamAssignment.deleteMany({
        where: {
          applicationId: application.id,
        },
      })
    }

    // Ajouter les nouvelles assignations d'équipes
    const teamIdsArray = Array.from(teamIds)
    if (teamIdsArray.length > 0) {
      // Créer les assignations d'équipes
      for (const teamId of teamIdsArray) {
        // Vérifier si l'assignation existe déjà
        const existingAssignment = await tx.applicationTeamAssignment.findUnique({
          where: {
            applicationId_teamId: {
              applicationId: application.id,
              teamId: teamId,
            },
          },
        })

        if (!existingAssignment) {
          await tx.applicationTeamAssignment.create({
            data: {
              applicationId: application.id,
              teamId: teamId,
              isLeader: false,
            },
          })
        }
      }
    }
  }
}
