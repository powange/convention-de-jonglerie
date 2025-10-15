import { requireAuth } from '@@/server/utils/auth-utils'
import { canManageEditionVolunteers } from '@@/server/utils/collaborator-management'
import { getVolunteerTeamById, setTeamLeader } from '@@/server/utils/editions/volunteers/teams'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const bodySchema = z.object({
  isLeader: z.boolean(),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const applicationId = parseInt(getRouterParam(event, 'applicationId') || '0')
  const teamId = getRouterParam(event, 'teamId') || ''

  if (!editionId || !applicationId || !teamId)
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })

  const parsed = bodySchema.parse(await readBody(event))

  // Vérifier les permissions
  const allowed = await canManageEditionVolunteers(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour gérer les bénévoles',
    })

  // Vérifier que l'application existe et appartient à cette édition
  const application = await prisma.editionVolunteerApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      editionId: true,
      status: true,
      user: {
        select: { id: true, pseudo: true, prenom: true, nom: true },
      },
    },
  })

  if (!application || application.editionId !== editionId)
    throw createError({ statusCode: 404, message: 'Candidature introuvable' })

  if (application.status !== 'ACCEPTED')
    throw createError({
      statusCode: 400,
      message: 'Seuls les bénévoles acceptés peuvent être responsables',
    })

  // Vérifier que l'équipe existe et appartient à cette édition
  const team = await getVolunteerTeamById(teamId)

  if (!team || team.editionId !== editionId)
    throw createError({ statusCode: 404, message: 'Équipe introuvable' })

  try {
    // Mettre à jour le statut de leader
    const updatedAssignment = await setTeamLeader(applicationId, teamId, parsed.isLeader)

    return {
      success: true,
      assignment: {
        ...updatedAssignment,
        application: {
          user: application.user,
        },
      },
      message: parsed.isLeader
        ? `${application.user.pseudo} est maintenant responsable de l'équipe ${team.name}`
        : `${application.user.pseudo} n'est plus responsable de l'équipe ${team.name}`,
    }
  } catch (error: unknown) {
    // Si l'assignation n'existe pas, Prisma lancera une erreur
    if (error.code === 'P2025') {
      throw createError({
        statusCode: 404,
        message: "Le bénévole n'est pas assigné à cette équipe",
      })
    }
    throw error
  }
})
