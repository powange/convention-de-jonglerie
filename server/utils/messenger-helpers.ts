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

  // 2. Trouver le responsable de l'équipe
  const teamLeader = await client.applicationTeamAssignment.findFirst({
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

  // Si il y a un responsable et que ce n'est pas le même utilisateur
  if (teamLeader && teamLeader.application.userId !== userId) {
    // 3. Créer ou récupérer la conversation privée avec le responsable
    let leaderConversation = await client.conversation.findFirst({
      where: {
        editionId,
        teamId,
        type: 'TEAM_LEADER_PRIVATE',
        participants: {
          every: {
            userId: {
              in: [userId, teamLeader.application.userId],
            },
          },
        },
      },
    })

    if (!leaderConversation) {
      leaderConversation = await client.conversation.create({
        data: {
          editionId,
          teamId,
          type: 'TEAM_LEADER_PRIVATE',
          participants: {
            create: [{ userId }, { userId: teamLeader.application.userId }],
          },
        },
      })
    } else {
      // Vérifier que les deux participants sont actifs
      const participants = await client.conversationParticipant.findMany({
        where: {
          conversationId: leaderConversation.id,
          userId: {
            in: [userId, teamLeader.application.userId],
          },
        },
      })

      for (const participant of participants) {
        if (participant.leftAt) {
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
