import { z } from 'zod'

import { canManageEditionVolunteers } from '../../../../../../../../utils/collaborator-management'
import { prisma } from '../../../../../../../../utils/prisma'

const bodySchema = z.object({
  isLeader: z.boolean(),
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const applicationId = parseInt(getRouterParam(event, 'applicationId') || '0')
  const teamId = getRouterParam(event, 'teamId') || ''

  if (!editionId || !applicationId || !teamId)
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })

  const parsed = bodySchema.parse(await readBody(event))

  // Vérifier les permissions
  const allowed = await canManageEditionVolunteers(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour gérer les bénévoles',
    })

  // Vérifier que l'application existe et appartient à cette édition
  const application = await prisma.editionVolunteerApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, editionId: true, status: true },
  })

  if (!application || application.editionId !== editionId)
    throw createError({ statusCode: 404, message: 'Candidature introuvable' })

  if (application.status !== 'ACCEPTED')
    throw createError({
      statusCode: 400,
      message: 'Seuls les bénévoles acceptés peuvent être responsables',
    })

  // Vérifier que l'équipe existe et appartient à cette édition
  const team = await prisma.volunteerTeam.findUnique({
    where: { id: teamId },
    select: { id: true, editionId: true, name: true },
  })

  if (!team || team.editionId !== editionId)
    throw createError({ statusCode: 404, message: 'Équipe introuvable' })

  // Vérifier que l'assignation existe
  const assignment = await prisma.applicationTeamAssignment.findUnique({
    where: {
      applicationId_teamId: {
        applicationId,
        teamId,
      },
    },
  })

  if (!assignment)
    throw createError({
      statusCode: 404,
      message: "Le bénévole n'est pas assigné à cette équipe",
    })

  // Mettre à jour le statut de leader
  const updatedAssignment = await prisma.applicationTeamAssignment.update({
    where: {
      applicationId_teamId: {
        applicationId,
        teamId,
      },
    },
    data: {
      isLeader: parsed.isLeader,
    },
    include: {
      application: {
        select: {
          user: {
            select: { id: true, pseudo: true, prenom: true, nom: true },
          },
        },
      },
      team: {
        select: { id: true, name: true, color: true },
      },
    },
  })

  return {
    success: true,
    assignment: updatedAssignment,
    message: parsed.isLeader
      ? `${updatedAssignment.application.user.pseudo} est maintenant responsable de l'équipe ${team.name}`
      : `${updatedAssignment.application.user.pseudo} n'est plus responsable de l'équipe ${team.name}`,
  }
})
