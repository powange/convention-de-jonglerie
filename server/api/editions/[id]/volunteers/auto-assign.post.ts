import { z } from 'zod'

import { requireAuth } from '../../../../utils/auth-utils'
import { canManageEditionVolunteers } from '../../../../utils/collaborator-management'
import { prisma } from '../../../../utils/prisma'
import { VolunteerScheduler } from '../../../../utils/volunteer-scheduler'

// Schéma de validation pour les contraintes
const constraintsSchema = z.object({
  maxHoursPerVolunteer: z.number().min(1).max(24).optional(),
  minHoursPerVolunteer: z.number().min(0).max(12).optional(),
  maxHoursPerDay: z.number().min(1).max(12).optional(),
  minHoursPerDay: z.number().min(0).max(8).optional(),
  balanceTeams: z.boolean().optional(),
  prioritizeExperience: z.boolean().optional(),
  respectStrictAvailability: z.boolean().optional(),
  allowOvertime: z.boolean().optional(),
  maxOvertimeHours: z.number().min(0).max(6).optional(),
})

export default defineEventHandler(async (event) => {
  try {
    // Vérification de l'authentification
    const user = requireAuth(event)
    const editionId = parseInt(getRouterParam(event, 'id') as string)

    if (!editionId || isNaN(editionId)) {
      throw createError({
        statusCode: 400,
        statusMessage: "ID d'édition invalide",
      })
    }

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
          teams: true,
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

    // Conversion des données pour l'algorithme
    const schedulerVolunteers = volunteers.map((volunteer: any) => ({
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
    }))

    const schedulerTimeSlots = timeSlots.map((slot: any) => ({
      id: slot.id.toString(),
      title: slot.title || 'Créneau sans titre',
      start: slot.startDateTime.toISOString(),
      end: slot.endDateTime.toISOString(),
      teamId: slot.teamId?.toString() || undefined,
      maxVolunteers: slot.maxVolunteers,
      assignedVolunteers: slot.assignments.length,
      description: slot.description || undefined,
      requiredSkills: [], // TODO: Ajouter si nécessaire
      priority: 3, // TODO: Calculer selon critères
    }))

    const schedulerTeams = teams.map((team: any) => ({
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
      await applyAssignments(editionId, result.assignments, user.id)
    }

    return {
      success: true,
      result,
      preview: body.applyAssignments !== true, // Indique si c'est un aperçu ou une application
    }
  } catch (error: any) {
    console.error("Erreur lors de l'auto-assignation:", error)

    // Gestion des erreurs de validation Zod
    if (error.issues) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Contraintes invalides',
        data: error.issues,
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: error.message || "Erreur lors de l'auto-assignation",
    })
  }
})

/**
 * Applique les assignations en base de données
 */
async function applyAssignments(
  editionId: number,
  assignments: any[],
  userId: number
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 1. Supprimer toutes les assignations existantes pour cette édition
    await tx.volunteerAssignment.deleteMany({
      where: {
        timeSlot: {
          editionId,
        },
      },
    })

    // 2. Créer les nouvelles assignations
    for (const assignment of assignments) {
      await tx.volunteerAssignment.create({
        data: {
          timeSlotId: assignment.slotId,
          userId: assignment.volunteerId,
          assignedById: userId,
          assignedAt: new Date(),
        },
      })
    }

    // 3. Log de l'action
    console.log(
      `Auto-assignation appliquée pour l'édition ${editionId} par l'utilisateur ${userId}`
    )
    console.log(`${assignments.length} assignations créées`)
  })
}
