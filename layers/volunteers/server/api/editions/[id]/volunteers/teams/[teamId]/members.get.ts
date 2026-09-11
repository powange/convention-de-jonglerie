import { createHash } from 'node:crypto'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { equipesDontIlEstResponsable } from '#server/utils/editions/volunteers/responsables-equipe'
import { userWithNameSelect } from '#server/utils/prisma-select-helpers'
import { sanitizeEmail, validateEditionId } from '#server/utils/validation-helpers'

/**
 * Récupère les membres d'une équipe de bénévoles avec leurs coordonnées
 * Vérifie que l'utilisateur connecté est leader de cette équipe
 * Renvoie l'email et le téléphone des membres pour permettre au leader de les contacter
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const teamId = getRouterParam(event, 'teamId')

    if (!teamId) {
      throw createError({
        status: 400,
        message: 'Equipe invalide',
      })
    }

    // Responsable de cette équipe — comme bénévole accepté ou comme organisateur rattaché.
    const equipesDirigees = await equipesDontIlEstResponsable(editionId, user.id)

    if (!equipesDirigees.includes(teamId)) {
      throw createError({
        status: 403,
        message: 'Vous devez être leader de cette équipe pour voir ses membres',
      })
    }

    // Récupérer tous les membres de l'équipe
    const teamAssignments = await prisma.applicationTeamAssignment.findMany({
      where: {
        teamId,
        application: {
          eventId: editionId,
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
                ...userWithNameSelect,
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
        .update(sanitizeEmail(assignment.application.user.email))
        .digest('hex'),
      phone: assignment.application.userSnapshotPhone,
      profilePicture: assignment.application.user.profilePicture,
      isLeader: assignment.isLeader,
      assignedAt: assignment.assignedAt,
    }))
  },
  { operationName: 'GetVolunteerTeamMembers' }
)
