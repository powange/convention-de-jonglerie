import { z } from 'zod'

import { canManageEditionVolunteers } from '../../../../../../utils/collaborator-management'
import { prisma } from '../../../../../../utils/prisma'

const bodySchema = z.object({
  teams: z.array(z.string()), // Noms des équipes pour l'assignation
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const applicationId = parseInt(getRouterParam(event, 'applicationId') || '0')
  if (!editionId || !applicationId)
    throw createError({ statusCode: 400, statusMessage: 'Paramètres invalides' })
  const parsed = bodySchema.parse(await readBody(event))

  const allowed = await canManageEditionVolunteers(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      statusMessage: 'Droits insuffisants pour gérer les bénévoles',
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
    throw createError({ statusCode: 404, statusMessage: 'Candidature introuvable' })

  // Vérifier que le bénévole est en attente ou accepté (pas rejeté)
  if (application.status === 'REJECTED')
    throw createError({
      statusCode: 400,
      statusMessage: 'Les équipes ne peuvent être assignées aux bénévoles rejetés',
    })

  // Mettre à jour la candidature avec les équipes assignées
  const updated = await prisma.editionVolunteerApplication.update({
    where: { id: applicationId },
    data: {
      assignedTeams: parsed.teams,
    },
    select: { id: true, assignedTeams: true },
  })

  return {
    success: true,
    application: updated,
    teams: parsed.teams,
    message: `Assigné à ${parsed.teams.length} équipe(s)`,
  }
})
