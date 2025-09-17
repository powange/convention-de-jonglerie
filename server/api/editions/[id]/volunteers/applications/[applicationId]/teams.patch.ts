import { z } from 'zod'

import { canManageEditionVolunteers } from '../../../../../../utils/collaborator-management'
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

  // Récupérer les équipes de cette édition pour faire le mapping noms -> IDs
  const availableTeams = await prisma.volunteerTeam.findMany({
    where: { editionId },
    select: { id: true, name: true },
  })

  // Mapper les noms/IDs d'équipes vers les IDs des VolunteerTeam
  const teamIds: string[] = []
  for (const teamIdentifier of parsed.teams) {
    // Chercher d'abord par ID, puis par nom (pour compatibilité)
    let team = availableTeams.find((t) => t.id === teamIdentifier)
    if (!team) {
      team = availableTeams.find(
        (t) => t.name.toLowerCase().trim() === teamIdentifier.toLowerCase().trim()
      )
    }

    if (team) {
      teamIds.push(team.id)
    } else {
      throw createError({
        statusCode: 400,
        message: `Équipe "${teamIdentifier}" introuvable dans cette édition`,
      })
    }
  }

  // Mettre à jour les relations avec les nouvelles équipes
  const updated = await prisma.editionVolunteerApplication.update({
    where: { id: applicationId },
    data: {
      // Conserver l'ancien système pour compatibilité
      assignedTeams: parsed.teams,
      // Utiliser le nouveau système de relations
      teams: {
        set: teamIds.map((id) => ({ id })),
      },
    },
    select: {
      id: true,
      assignedTeams: true,
      teams: {
        select: {
          id: true,
          name: true,
          color: true,
          description: true,
        },
      },
    },
  })

  return {
    success: true,
    application: updated,
    teams: parsed.teams,
    message: `Assigné à ${parsed.teams.length} équipe(s)`,
  }
})
