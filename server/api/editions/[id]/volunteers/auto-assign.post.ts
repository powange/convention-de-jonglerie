import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canManageEditionVolunteers } from '@@/server/utils/organizer-management'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { VolunteerScheduler } from '@@/server/utils/volunteer-scheduler'
import { z } from 'zod'

import type { PrismaTransaction, AutoAssignmentResult } from '@@/server/types/prisma-helpers'
import type { Prisma } from '@prisma/client'

// Types pour les données récupérées de la base de données
type VolunteerWithTeamAssignments = Prisma.EditionVolunteerApplicationGetPayload<{
  include: {
    user: { select: { id: true; pseudo: true; nom: true; prenom: true } }
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
  respectStrictTimePreferences: z.boolean().optional(),
  allowOvertime: z.boolean().optional(),
  maxOvertimeHours: z.number().min(0).max(6).optional(),
  keepExistingAssignments: z.boolean().optional(),
})

export default wrapApiHandler(async (event) => {
  // Vérification de l'authentification
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  // Vérification des permissions
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    include: {
      convention: {
        include: {
          collaborators: true,
        },
      },
    },
  })

  if (!edition) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Édition non trouvée',
    })
  }

  if (!(await canManageEditionVolunteers(editionId, user.id, event))) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Droits insuffisants pour gérer les bénévoles',
    })
  }

  // Lecture et validation du body
  const body = await readBody(event)
  const constraints = constraintsSchema.parse(body.constraints || {})

  // Récupération des données nécessaires
  const [volunteers, timeSlots, teams] = await Promise.all([
    // Bénévoles acceptés
    prisma.editionVolunteerApplication.findMany({
      where: {
        editionId,
        status: 'ACCEPTED',
      },
      include: {
        user: {
          select: {
            id: true,
            pseudo: true,
            nom: true,
            prenom: true,
          },
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
      where: { editionId },
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
      where: { editionId },
    }),
  ])

  // Si on garde les assignations existantes, filtrer les bénévoles déjà assignés
  let availableVolunteers = volunteers
  if (constraints.keepExistingAssignments) {
    // Récupérer les IDs des bénévoles déjà assignés
    const assignedVolunteerIds = new Set(
      timeSlots.flatMap((slot: TimeSlotWithAssignments) =>
        slot.assignments.map((assignment) => assignment.user.id)
      )
    )
    // Filtrer uniquement les bénévoles non assignés
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
    })
  )

  const schedulerTimeSlots = timeSlots.map((slot: TimeSlotWithAssignments) => ({
    id: slot.id.toString(),
    title: slot.title || 'Créneau sans titre',
    start: slot.startDateTime.toISOString(),
    end: slot.endDateTime.toISOString(),
    teamId: slot.teamId?.toString() || undefined,
    maxVolunteers: slot.maxVolunteers,
    // Si on garde les existantes, les comptabiliser dans les places déjà prises
    assignedVolunteers: constraints.keepExistingAssignments ? slot.assignments.length : 0,
    description: slot.description || undefined,
    requiredSkills: [], // TODO: Ajouter si nécessaire
    priority: 3, // TODO: Calculer selon critères
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
    constraints
  )

  const result = scheduler.assignVolunteers()

  // Application des assignations en base de données si demandé
  if (body.applyAssignments === true) {
    await applyAssignments(
      editionId,
      result.assignments,
      user.id,
      constraints.keepExistingAssignments
    )
  }

  return {
    success: true,
    result,
    preview: body.applyAssignments !== true, // Indique si c'est un aperçu ou une application
  }
}, 'AutoAssignVolunteers')

/**
 * Applique les assignations en base de données
 */
async function applyAssignments(
  editionId: number,
  assignments: AutoAssignmentResult[],
  userId: number,
  keepExisting?: boolean
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 1. Si on ne garde pas les existantes, les supprimer
    if (!keepExisting) {
      await tx.volunteerAssignment.deleteMany({
        where: {
          timeSlot: {
            editionId,
          },
        },
      })
    }

    // 2. Créer les nouvelles assignations aux créneaux
    for (const assignment of assignments) {
      // Si on garde les existantes, vérifier qu'elle n'existe pas déjà
      if (keepExisting) {
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
        },
      })
    }

    // 3. Assigner les bénévoles aux équipes correspondantes
    await assignVolunteersToTeams(tx, editionId, assignments, keepExisting)

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
  keepExisting?: boolean
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
        editionId_userId: {
          editionId,
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

    // Si on ne garde pas les existantes, supprimer les anciennes assignations d'équipes
    if (!keepExisting) {
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
