import { z } from 'zod'

import { canManageEditionVolunteers } from '../../../../../../utils/collaborator-management'
import {
  assignVolunteerToTeams,
  resolveTeamIdentifiers,
} from '../../../../../../utils/editions/volunteers/teams'
import { prisma } from '../../../../../../utils/prisma'

const bodySchema = z.object({
  teams: z.array(z.string()), // Noms ou IDs des équipes pour l'assignation
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const applicationId = parseInt(getRouterParam(event, 'applicationId') || '0')
  if (!editionId || !applicationId)
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })
  const parsed = bodySchema.parse(await readBody(event))

  const allowed = await canManageEditionVolunteers(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour gérer les bénévoles',
    })

  const application = await prisma.editionVolunteerApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      editionId: true,
      status: true,
      userId: true,
    },
  })
  if (!application || application.editionId !== editionId)
    throw createError({ statusCode: 404, message: 'Candidature introuvable' })

  // Vérifier que le bénévole est en attente ou accepté (pas rejeté)
  if (application.status === 'REJECTED')
    throw createError({
      statusCode: 400,
      message: 'Les équipes ne peuvent être assignées aux bénévoles rejetés',
    })

  try {
    // Résoudre les identifiants (IDs ou noms) en IDs d'équipes
    const teamIds = await resolveTeamIdentifiers(editionId, parsed.teams)

    // Assigner le bénévole aux équipes
    const assignments = await assignVolunteerToTeams(applicationId, teamIds)

    return {
      success: true,
      application: {
        id: applicationId,
        assignedTeams: teamIds,
        teamAssignments: assignments.map((a) => ({
          teamId: a.teamId,
          isLeader: a.isLeader,
          assignedAt: a.assignedAt,
          team: a.team,
        })),
      },
      teams: parsed.teams,
      message: `Assigné à ${parsed.teams.length} équipe(s)`,
    }
  } catch (error: any) {
    // Si c'est une erreur de notre util, la propager avec le bon format
    if (error.message?.includes('introuvable')) {
      throw createError({
        statusCode: 400,
        message: error.message,
      })
    }
    throw error
  }
})
