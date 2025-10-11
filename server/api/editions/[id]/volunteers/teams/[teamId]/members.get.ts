import { createHash } from 'node:crypto'

import { requireAuth } from '../../../../../../utils/auth-utils'
import { prisma } from '../../../../../../utils/prisma'

/**
 * Récupère les membres d'une équipe de bénévoles
 * Vérifie que l'utilisateur connecté est leader de cette équipe
 */
export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const teamId = getRouterParam(event, 'teamId')

  if (!editionId || !teamId) {
    throw createError({
      statusCode: 400,
      message: 'Edition ou équipe invalide',
    })
  }

  // Vérifier que l'utilisateur est leader de cette équipe
  const leaderAssignment = await prisma.applicationTeamAssignment.findFirst({
    where: {
      teamId,
      isLeader: true,
      application: {
        userId: user.id,
        editionId,
        status: 'ACCEPTED',
      },
    },
  })

  if (!leaderAssignment) {
    throw createError({
      statusCode: 403,
      message: 'Vous devez être leader de cette équipe pour voir ses membres',
    })
  }

  // Récupérer tous les membres de l'équipe
  const teamAssignments = await prisma.applicationTeamAssignment.findMany({
    where: {
      teamId,
      application: {
        editionId,
        status: 'ACCEPTED',
      },
    },
    select: {
      isLeader: true,
      assignedAt: true,
      application: {
        select: {
          user: {
            select: {
              id: true,
              pseudo: true,
              prenom: true,
              nom: true,
              email: true,
              profilePicture: true,
            },
          },
        },
      },
    },
    orderBy: [
      { isLeader: 'desc' }, // Leaders en premier
      { assignedAt: 'asc' },
    ],
  })

  // Formater les données avec le hash de l'email
  return teamAssignments.map((assignment) => ({
    id: assignment.application.user.id,
    pseudo: assignment.application.user.pseudo,
    prenom: assignment.application.user.prenom,
    nom: assignment.application.user.nom,
    emailHash: createHash('md5')
      .update(assignment.application.user.email.toLowerCase().trim())
      .digest('hex'),
    profilePicture: assignment.application.user.profilePicture,
    isLeader: assignment.isLeader,
    assignedAt: assignment.assignedAt,
  }))
})
