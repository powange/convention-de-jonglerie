import { prisma } from './prisma'

import type { PrismaTransaction } from '@@/server/types/prisma-helpers'

/**
 * Crée ou récupère les conversations pour un bénévole assigné à une équipe
 * @param editionId - ID de l'édition
 * @param teamId - ID de l'équipe
 * @param userId - ID de l'utilisateur (bénévole)
 * @param tx - Transaction Prisma optionnelle
 */
export async function ensureVolunteerConversations(
  editionId: number,
  teamId: string,
  userId: number,
  tx?: PrismaTransaction
) {
  const client = tx || prisma

  // 1. Créer ou récupérer la conversation de groupe de l'équipe
  let teamGroupConversation = await client.conversation.findFirst({
    where: {
      editionId,
      teamId,
      type: 'TEAM_GROUP',
    },
  })

  if (!teamGroupConversation) {
    teamGroupConversation = await client.conversation.create({
      data: {
        editionId,
        teamId,
        type: 'TEAM_GROUP',
      },
    })
  }

  // Ajouter l'utilisateur comme participant s'il n'est pas déjà participant
  const existingParticipant = await client.conversationParticipant.findFirst({
    where: {
      conversationId: teamGroupConversation.id,
      userId,
    },
  })

  if (!existingParticipant) {
    await client.conversationParticipant.create({
      data: {
        conversationId: teamGroupConversation.id,
        userId,
      },
    })
  } else if (existingParticipant.leftAt) {
    // Si l'utilisateur avait quitté, on le réactive
    await client.conversationParticipant.update({
      where: { id: existingParticipant.id },
      data: { leftAt: null },
    })
  }

  // 2. Trouver tous les responsables de l'équipe
  const teamLeaders = await client.applicationTeamAssignment.findMany({
    where: {
      teamId,
      isLeader: true,
      application: {
        editionId,
      },
    },
    include: {
      application: {
        select: {
          userId: true,
        },
      },
    },
  })

  // Filtrer pour exclure l'utilisateur actuel s'il est lui-même responsable
  const leaderUserIds = teamLeaders
    .map((leader) => leader.application.userId)
    .filter((leaderId) => leaderId !== userId)

  // Si il y a au moins un responsable différent de l'utilisateur
  if (leaderUserIds.length > 0) {
    // 3. Créer ou récupérer la conversation privée avec les responsables
    // Tous les participants attendus : l'utilisateur + tous les responsables
    const expectedParticipantIds = [userId, ...leaderUserIds].sort()

    // Chercher une conversation existante avec exactement ces participants
    const existingConversations = await client.conversation.findMany({
      where: {
        editionId,
        teamId,
        type: 'TEAM_LEADER_PRIVATE',
      },
      include: {
        participants: {
          where: {
            leftAt: null, // Uniquement les participants actifs
          },
          select: {
            userId: true,
          },
        },
      },
    })

    // Trouver une conversation qui a exactement les bons participants
    let leaderConversation = existingConversations.find((conv) => {
      const actualParticipantIds = conv.participants.map((p) => p.userId).sort()
      return (
        actualParticipantIds.length === expectedParticipantIds.length &&
        actualParticipantIds.every((id, index) => id === expectedParticipantIds[index])
      )
    })

    if (!leaderConversation) {
      // Créer une nouvelle conversation avec tous les participants
      leaderConversation = await client.conversation.create({
        data: {
          editionId,
          teamId,
          type: 'TEAM_LEADER_PRIVATE',
          participants: {
            create: expectedParticipantIds.map((participantUserId) => ({
              userId: participantUserId,
            })),
          },
        },
      })
    } else {
      // Vérifier que tous les participants sont actifs et les réactiver si nécessaire
      const allParticipants = await client.conversationParticipant.findMany({
        where: {
          conversationId: leaderConversation.id,
        },
      })

      for (const participant of allParticipants) {
        if (participant.leftAt && expectedParticipantIds.includes(participant.userId)) {
          await client.conversationParticipant.update({
            where: { id: participant.id },
            data: { leftAt: null },
          })
        }
      }
    }
  }
}

/**
 * Supprime un utilisateur de toutes les conversations d'une équipe
 * @param editionId - ID de l'édition
 * @param teamId - ID de l'équipe
 * @param userId - ID de l'utilisateur
 * @param tx - Transaction Prisma optionnelle
 */
export async function removeVolunteerFromTeamConversations(
  editionId: number,
  teamId: string,
  userId: number,
  tx?: PrismaTransaction
) {
  const client = tx || prisma

  const conversations = await client.conversation.findMany({
    where: {
      editionId,
      teamId,
    },
  })

  for (const conversation of conversations) {
    const participant = await client.conversationParticipant.findFirst({
      where: {
        conversationId: conversation.id,
        userId,
      },
    })

    if (participant && !participant.leftAt) {
      await client.conversationParticipant.update({
        where: { id: participant.id },
        data: { leftAt: new Date() },
      })
    }
  }
}

/**
 * Crée ou récupère une conversation entre un bénévole et les organisateurs ayant les droits de gestion des bénévoles
 * @param editionId - ID de l'édition
 * @param volunteerId - ID du bénévole
 * @param tx - Transaction Prisma optionnelle
 * @returns L'ID de la conversation créée ou existante
 */
export async function ensureVolunteerToOrganizersConversation(
  editionId: number,
  volunteerId: number,
  tx?: PrismaTransaction
): Promise<string> {
  const client = tx || prisma

  // 1. Récupérer l'édition avec la convention pour les organisateurs
  const edition = await client.edition.findUnique({
    where: { id: editionId },
    select: {
      conventionId: true,
    },
  })

  if (!edition) {
    throw new Error('Édition introuvable')
  }

  // 2. Récupérer tous les organisateurs ayant les droits de gestion des bénévoles
  // Soit au niveau de la convention (ConventionOrganizer.canManageVolunteers)
  // Soit au niveau de l'édition (EditionOrganizerPermission.canManageVolunteers)
  const conventionOrganizers = await client.conventionOrganizer.findMany({
    where: {
      conventionId: edition.conventionId,
      OR: [
        { canManageVolunteers: true }, // Permissions globales
        {
          perEditionPermissions: {
            some: {
              editionId,
              canManageVolunteers: true, // Permissions spécifiques à l'édition
            },
          },
        },
      ],
    },
    select: {
      userId: true,
    },
  })

  const organizerUserIds = conventionOrganizers.map((org) => org.userId)

  // Si aucun organisateur n'a les droits, lever une erreur
  if (organizerUserIds.length === 0) {
    throw new Error('Aucun organisateur avec les droits de gestion des bénévoles trouvé')
  }

  // 2. Chercher une conversation existante avec le bénévole comme participant
  const existingConversation = await client.conversation.findFirst({
    where: {
      editionId,
      teamId: null, // Pas liée à une équipe
      type: 'VOLUNTEER_TO_ORGANIZERS',
      participants: {
        some: {
          userId: volunteerId,
        },
      },
    },
    include: {
      participants: true,
    },
  })

  let conversation: any

  if (!existingConversation) {
    // 3. Créer une nouvelle conversation avec le bénévole + tous les organisateurs
    const allParticipantIds = [volunteerId, ...organizerUserIds]
    conversation = await client.conversation.create({
      data: {
        editionId,
        teamId: null,
        type: 'VOLUNTEER_TO_ORGANIZERS',
        participants: {
          create: allParticipantIds.map((participantUserId) => ({
            userId: participantUserId,
          })),
        },
      },
    })
  } else {
    // 4. Synchroniser les participants : ajouter les nouveaux organisateurs
    conversation = existingConversation

    // Pour chaque organisateur actuel avec les droits
    for (const organizerUserId of organizerUserIds) {
      const existingParticipant = existingConversation.participants.find(
        (p) => p.userId === organizerUserId
      )

      if (!existingParticipant) {
        // Ajouter le nouvel organisateur
        await client.conversationParticipant.create({
          data: {
            conversationId: conversation.id,
            userId: organizerUserId,
          },
        })
      } else if (existingParticipant.leftAt) {
        // Réactiver l'organisateur s'il avait quitté
        await client.conversationParticipant.update({
          where: { id: existingParticipant.id },
          data: { leftAt: null },
        })
      }
    }

    // Réactiver le bénévole s'il avait quitté
    const volunteerParticipant = existingConversation.participants.find(
      (p) => p.userId === volunteerId
    )
    if (volunteerParticipant?.leftAt) {
      await client.conversationParticipant.update({
        where: { id: volunteerParticipant.id },
        data: { leftAt: null },
      })
    }
  }

  return conversation.id
}
