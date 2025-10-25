import { createHash } from 'node:crypto'

import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'

/**
 * Récupère les membres d'une équipe de bénévoles avec leurs coordonnées
 * Vérifie que l'utilisateur connecté est leader de cette équipe
 * Renvoie l'email et le téléphone des membres pour permettre au leader de les contacter
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
          userSnapshotPhone: true,
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

  // Formater les données avec l'email et le téléphone complets
  return teamAssignments.map((assignment) => ({
    id: assignment.application.user.id,
    pseudo: assignment.application.user.pseudo,
    prenom: assignment.application.user.prenom,
    nom: assignment.application.user.nom,
    email: assignment.application.user.email,
    emailHash: createHash('md5')
      .update(assignment.application.user.email.toLowerCase().trim())
      .digest('hex'),
    phone: assignment.application.userSnapshotPhone,
    profilePicture: assignment.application.user.profilePicture,
    isLeader: assignment.isLeader,
    assignedAt: assignment.assignedAt,
  }))
})
