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

/**
 * Crée ou récupère la conversation de groupe entre tous les organisateurs d'une édition
 * @param editionId - ID de l'édition
 * @param tx - Transaction Prisma optionnelle
 * @returns L'ID de la conversation créée ou existante
 */
export async function ensureOrganizersGroupConversation(
  editionId: number,
  tx?: PrismaTransaction
): Promise<string> {
  const client = tx || prisma

  // 1. Récupérer tous les organisateurs de l'édition (table EditionOrganizer)
  // On passe par la relation organizer (ConventionOrganizer) pour obtenir le userId
  const editionOrganizers = await client.editionOrganizer.findMany({
    where: {
      editionId,
    },
    select: {
      organizer: {
        select: {
          userId: true,
        },
      },
    },
  })

  const organizerUserIds = editionOrganizers.map((org) => org.organizer.userId)

  // Si aucun organisateur, lever une erreur
  if (organizerUserIds.length === 0) {
    throw new Error('Aucun organisateur trouvé pour cette édition')
  }

  // 2. Chercher la conversation existante de type ORGANIZERS_GROUP pour cette édition
  const existingConversation = await client.conversation.findFirst({
    where: {
      editionId,
      teamId: null,
      type: 'ORGANIZERS_GROUP',
    },
    include: {
      participants: true,
    },
  })

  let conversation: { id: string }

  if (!existingConversation) {
    // 3. Créer une nouvelle conversation avec tous les organisateurs
    conversation = await client.conversation.create({
      data: {
        editionId,
        teamId: null,
        type: 'ORGANIZERS_GROUP',
        participants: {
          create: organizerUserIds.map((userId) => ({
            userId,
          })),
        },
      },
    })
  } else {
    // 4. Synchroniser les participants
    conversation = existingConversation

    // Pour chaque organisateur actuel
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

    // Marquer comme "parti" les participants qui ne sont plus organisateurs
    for (const participant of existingConversation.participants) {
      if (!organizerUserIds.includes(participant.userId) && !participant.leftAt) {
        await client.conversationParticipant.update({
          where: { id: participant.id },
          data: { leftAt: new Date() },
        })
      }
    }
  }

  return conversation.id
}

/**
 * Synchronise les participants de la conversation ORGANIZERS_GROUP quand un organisateur est ajouté/retiré
 * @param editionId - ID de l'édition
 * @param tx - Transaction Prisma optionnelle
 */
export async function syncOrganizersGroupParticipants(
  editionId: number,
  tx?: PrismaTransaction
): Promise<void> {
  const client = tx || prisma

  // Vérifier si la conversation existe
  const existingConversation = await client.conversation.findFirst({
    where: {
      editionId,
      teamId: null,
      type: 'ORGANIZERS_GROUP',
    },
  })

  // Si la conversation n'existe pas encore, ne rien faire
  // Elle sera créée quand un organisateur y accèdera
  if (!existingConversation) {
    return
  }

  // Appeler ensureOrganizersGroupConversation qui synchronisera les participants
  await ensureOrganizersGroupConversation(editionId, tx)
}

/**
 * Crée ou récupère une conversation pour une candidature artiste
 *
 * Participants initiaux :
 * - L'artiste (userId de la ShowApplication)
 * - L'utilisateur qui envoie le premier message (senderId)
 *
 * Les autres organisateurs/admins peuvent voir la conversation mais ne sont
 * ajoutés comme participants que quand ils envoient un message.
 *
 * @param applicationId - ID de la candidature
 * @param senderId - ID de l'utilisateur qui crée/envoie le premier message
 * @param tx - Transaction Prisma optionnelle
 * @returns L'ID de la conversation créée ou existante
 */
export async function ensureShowApplicationConversation(
  applicationId: number,
  senderId: number,
  tx?: PrismaTransaction
): Promise<string> {
  const client = tx || prisma

  // 1. Récupérer la candidature avec l'édition
  const application = await client.showApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      userId: true,
      showCall: {
        select: {
          edition: {
            select: {
              id: true,
            },
          },
        },
      },
    },
  })

  if (!application) {
    throw new Error('Candidature introuvable')
  }

  const editionId = application.showCall.edition.id
  const artistUserId = application.userId

  // 2. Vérifier si une conversation existe déjà pour cette candidature
  const existingConversation = await client.conversation.findUnique({
    where: { showApplicationId: applicationId },
    include: { participants: true },
  })

  if (existingConversation) {
    // Ajouter le sender comme participant s'il ne l'est pas déjà
    await addShowApplicationParticipantIfNeeded(existingConversation, senderId, client)
    return existingConversation.id
  }

  // 3. Créer la conversation avec l'artiste et l'expéditeur
  const participantIds = [...new Set([artistUserId, senderId])]

  const conversation = await client.conversation.create({
    data: {
      editionId,
      showApplicationId: applicationId,
      type: 'ARTIST_APPLICATION',
      participants: {
        create: participantIds.map((userId) => ({ userId })),
      },
    },
  })

  return conversation.id
}

/**
 * Ajoute un utilisateur comme participant à une conversation de candidature artiste
 * s'il n'est pas déjà participant (appelé quand quelqu'un envoie un message)
 */
export async function addShowApplicationParticipantIfNeeded(
  conversation: { id: string; participants: { userId: number; leftAt: Date | null }[] },
  userId: number,
  client: PrismaTransaction | typeof prisma
): Promise<void> {
  const existingParticipant = conversation.participants.find((p) => p.userId === userId)

  if (!existingParticipant) {
    // Ajouter comme nouveau participant
    await client.conversationParticipant.create({
      data: {
        conversationId: conversation.id,
        userId,
      },
    })
  } else if (existingParticipant.leftAt) {
    // Réactiver un participant qui avait quitté
    await client.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId: conversation.id,
          userId,
        },
      },
      data: { leftAt: null },
    })
  }
}
