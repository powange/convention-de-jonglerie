import type { PrismaTransaction } from '#server/types/prisma-helpers'

import { utilisateursResponsablesDeLEquipe } from '#server/utils/editions/volunteers/responsables-equipe'

/**
 * Crée ou récupère les conversations pour une personne rattachée à une équipe.
 *
 * Sert aussi bien à un bénévole assigné qu'à un organisateur rattaché : c'est la place dans
 * l'équipe qui donne accès à sa conversation, pas le titre auquel on l'occupe.
 *
 * @param editionId - ID de l'édition
 * @param teamId - ID de l'équipe
 * @param userId - ID de l'utilisateur concerné
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

  // 2. Trouver tous les responsables de l'équipe — bénévoles acceptés comme organisateurs
  // rattachés, les deux titres se valent.
  const responsables = await utilisateursResponsablesDeLEquipe(editionId, teamId, tx)

  // Filtrer pour exclure l'utilisateur actuel s'il est lui-même responsable
  const leaderUserIds = responsables.filter((leaderId) => leaderId !== userId)

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
 * Retire un bénévole de sa conversation avec les organisateurs de l'édition.
 *
 * Le pendant de [ensureVolunteerToOrganizersConversation], et le jumeau de
 * [removeVolunteerFromTeamConversations] un cran plus loin : une candidature refusée retirait le
 * bénévole des équipes mais le laissait dans ce fil-là, où l'on parle de la candidature qu'on vient
 * précisément de refuser.
 *
 * `leftAt` et non une suppression : l'historique du fil doit rester lisible pour les organisateurs
 * qui y ont écrit, et c'est déjà la règle des conversations d'équipe. Le contrôle d'accès lit ce
 * champ — un participant marqué parti ne peut plus lire.
 *
 * ⚠️ Le bénévole peut ÊTRE organisateur de l'édition. Sa participation est alors légitime à deux
 * titres, et le retirer ici lui fermerait un fil auquel il a droit par l'autre. D'où le contrôle
 * avant retrait, plutôt qu'un `updateMany` aveugle.
 */
export async function removeVolunteerFromOrganizersConversation(
  editionId: number,
  volunteerId: number,
  tx?: PrismaTransaction
) {
  const client = tx || prisma

  const conversation = await client.conversation.findFirst({
    where: {
      editionId,
      teamId: null,
      type: 'VOLUNTEER_TO_ORGANIZERS',
      participants: { some: { userId: volunteerId } },
    },
    select: { id: true },
  })

  if (!conversation) return

  /*
   * La bonne question n'est pas « est-il organisateur ? » mais « fait-il partie des organisateurs
   * POUR QUI ce fil existe ? ».
   *
   * D'où la même requête que celle qui les y ajoute, quelques lignes plus bas : un membre de la
   * convention habilité à gérer les bénévoles, globalement ou sur cette édition. Un organisateur
   * sans ce droit n'est pas dans ce fil, et le retirer d'une candidature refusée est donc juste.
   */
  const edition = await client.edition.findUnique({
    where: { id: editionId },
    select: { conventionId: true },
  })
  if (!edition) return

  const estOrganisateurDuFil = await client.conventionOrganizer.findFirst({
    where: {
      conventionId: edition.conventionId,
      userId: volunteerId,
      OR: [
        { canManageVolunteers: true },
        { perEditionPermissions: { some: { editionId, canManageVolunteers: true } } },
      ],
    },
    select: { id: true },
  })

  if (estOrganisateurDuFil) return

  const participant = await client.conversationParticipant.findFirst({
    where: { conversationId: conversation.id, userId: volunteerId },
  })

  if (participant && !participant.leftAt) {
    await client.conversationParticipant.update({
      where: { id: participant.id },
      data: { leftAt: new Date() },
    })
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
    // 3. Créer une nouvelle conversation avec le bénévole + tous les organisateurs.
    // Dédupliquer : le bénévole peut aussi être organisateur → sans ça, un doublon
    // (conversationId, userId) violerait la contrainte @@unique des participants (500).
    const allParticipantIds = [...new Set([volunteerId, ...organizerUserIds])]
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
 * Crée ou récupère une conversation pour une candidature artiste.
 *
 * Participants : l'artiste, l'expéditeur, ET tous les organisateurs habilités sur les artistes de
 * l'édition — la même liste que pour le groupe d'un spectacle.
 *
 * Auparavant, seuls l'artiste et l'expéditeur étaient inscrits, les autres organisateurs ne
 * l'étant qu'en écrivant eux-mêmes. Quand l'artiste écrivait le PREMIER, depuis « Mes
 * candidatures », il se retrouvait donc **seul participant de sa propre conversation**. Comme
 * l'envoi d'un message ne notifie que les participants, personne n'était prévenu, la conversation
 * n'apparaissait dans la messagerie d'aucun organisateur, et le message dormait jusqu'à ce qu'un
 * organisateur ouvre cette fiche par hasard. C'est exactement ce qu'un artiste n'a aucun moyen de
 * savoir.
 *
 * Sur une conversation qui existe déjà, les organisateurs manquants sont ajoutés, et ceux qui
 * étaient marqués comme partis sont réactivés : `leftAt` n'est jamais posé par un geste de
 * l'utilisateur dans ce module, seulement par la perte d'une habilitation.
 *
 * Ce qui n'est PAS fait ici, contrairement au groupe d'un spectacle : marquer comme partis les
 * participants qui ne sont plus habilités. Là-bas la liste contient tout le monde, artistes
 * compris, donc « qui n'est pas dans la liste s'en va » a un sens. Ici l'artiste — et un admin
 * qui aurait répondu en mode admin — sont des participants légitimes absents de la liste des
 * organisateurs : la même règle les expulserait.
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

  // 2. Les organisateurs à qui cette conversation doit parvenir
  const organisateurs = await organisateursHabilitesSurLesArtistes(editionId, client)

  // 3. Vérifier si une conversation existe déjà pour cette candidature
  const existingConversation = await client.conversation.findUnique({
    where: { showApplicationId: applicationId },
    include: { participants: true },
  })

  if (existingConversation) {
    // L'expéditeur et les organisateurs manquants. Dédoublonné : l'expéditeur EST souvent l'un
    // des organisateurs, et deux créations pour le même couple heurteraient l'unicité
    // (conversationId, userId).
    for (const userId of new Set([senderId, ...organisateurs])) {
      await addShowApplicationParticipantIfNeeded(existingConversation, userId, client)
    }
    return existingConversation.id
  }

  // 4. Créer la conversation avec l'artiste, l'expéditeur et les organisateurs
  const participantIds = [...new Set([artistUserId, senderId, ...organisateurs])]

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

/**
 * Les organisateurs habilités sur les artistes d'une édition : ceux que `canManageArtistsById`
 * accepterait — même règle, mais énumérée plutôt qu'interrogée un par un.
 *
 * Une seule énumération pour les deux conversations qui en ont besoin, le groupe d'un spectacle
 * et la candidature d'un artiste : ce sont les mêmes destinataires, et deux listes auraient fini
 * par divulguer.
 */
async function organisateursHabilitesSurLesArtistes(
  editionId: number,
  client: PrismaTransaction | typeof prisma
): Promise<number[]> {
  const edition = await client.edition.findUnique({
    where: { id: editionId },
    select: {
      creatorId: true,
      convention: {
        select: {
          authorId: true,
          organizers: { where: { canManageArtists: true }, select: { userId: true } },
        },
      },
      organizerPermissions: {
        where: { canManageArtists: true },
        select: { organizer: { select: { userId: true } } },
      },
    },
  })

  if (!edition) {
    throw new Error('Édition introuvable')
  }

  return [
    ...new Set<number>([
      edition.creatorId,
      edition.convention.authorId,
      ...edition.convention.organizers.map((o) => o.userId),
      ...edition.organizerPermissions.map((p) => p.organizer.userId),
    ]),
  ]
}

/**
 * Les utilisateurs qui composent le groupe d'un spectacle : sa distribution, et les
 * organisateurs habilités sur les artistes.
 *
 * La distribution passe par `ShowArtist.showId`, renseigné y compris pour un cabaret dont les
 * artistes sont rattachés à un numéro : « les artistes du spectacle » a donc un sens dans les
 * deux cas.
 */
async function participantsDuGroupeSpectacle(
  showId: number,
  client: PrismaTransaction | typeof prisma
): Promise<{ editionId: number; userIds: number[] }> {
  const show = await client.show.findUnique({
    where: { id: showId },
    select: {
      editionId: true,
      artists: { select: { artist: { select: { userId: true } } } },
    },
  })

  if (!show) {
    throw new Error('Spectacle introuvable')
  }

  const organisateurs = await organisateursHabilitesSurLesArtistes(show.editionId, client)

  const userIds = new Set<number>([
    ...show.artists.map((lien) => lien.artist.userId),
    ...organisateurs,
  ])

  return { editionId: show.editionId, userIds: [...userIds] }
}

/**
 * Crée ou récupère le groupe de messagerie d'un spectacle, et aligne ses participants sur la
 * distribution du moment.
 *
 * Un artiste retiré du spectacle est marqué comme parti (`leftAt`) plutôt que supprimé : il
 * garde l'accès aux échanges auxquels il a pris part, mais ne reçoit plus la suite. C'est le
 * traitement déjà appliqué aux organisateurs qui perdent leurs droits.
 *
 * @param showId - ID du spectacle
 * @param tx - Transaction Prisma optionnelle
 * @returns L'ID de la conversation
 */
export async function ensureShowGroupConversation(
  showId: number,
  tx?: PrismaTransaction
): Promise<string> {
  const client = tx || prisma
  const { editionId, userIds } = await participantsDuGroupeSpectacle(showId, client)

  const existante = await client.conversation.findUnique({
    where: { showId },
    include: { participants: true },
  })

  if (!existante) {
    const conversation = await client.conversation.create({
      data: {
        editionId,
        showId,
        type: 'SHOW_GROUP',
        participants: { create: userIds.map((userId) => ({ userId })) },
      },
    })
    return conversation.id
  }

  for (const userId of userIds) {
    const participant = existante.participants.find((p) => p.userId === userId)
    if (!participant) {
      await client.conversationParticipant.create({
        data: { conversationId: existante.id, userId },
      })
    } else if (participant.leftAt) {
      await client.conversationParticipant.update({
        where: { id: participant.id },
        data: { leftAt: null },
      })
    }
  }

  for (const participant of existante.participants) {
    if (!userIds.includes(participant.userId) && !participant.leftAt) {
      await client.conversationParticipant.update({
        where: { id: participant.id },
        data: { leftAt: new Date() },
      })
    }
  }

  return existante.id
}

/**
 * Aligne les participants du groupe d'un spectacle après un changement de distribution.
 *
 * Ne crée rien si le groupe n'existe pas encore : tant que personne n'a écrit au spectacle,
 * il n'y a pas de conversation à tenir à jour.
 *
 * @param showId - ID du spectacle
 * @param tx - Transaction Prisma optionnelle
 */
export async function syncShowGroupParticipants(
  showId: number,
  tx?: PrismaTransaction
): Promise<void> {
  const client = tx || prisma

  const existante = await client.conversation.findUnique({
    where: { showId },
    select: { id: true },
  })

  if (!existante) return

  await ensureShowGroupConversation(showId, tx)
}
