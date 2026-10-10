import type { PrismaTransaction } from '#server/types/prisma-helpers'

import { utilisateursResponsablesDeLEquipe } from '#server/utils/editions/volunteers/responsables-equipe'
import { organisateursHabilitesSurLesArtistes } from '#server/utils/organisateurs-des-artistes'

/** Un fil privé avec les responsables, réduit à ce qui sert à le reconnaître. */
type FilDeResponsables = {
  id: string
  participants: { id: string; userId: number; leftAt: Date | null }[]
}

/** Deux ensembles d'identifiants sont-ils exactement les mêmes ? */
function memeEnsemble(identifiants: number[], attendus: Set<number>): boolean {
  return identifiants.length === attendus.size && identifiants.every((id) => attendus.has(id))
}

/**
 * Crée ou récupère les conversations d'équipe pour PLUSIEURS personnes d'un coup.
 *
 * Sert aussi bien à des bénévoles assignés qu'à des organisateurs rattachés : c'est la place dans
 * l'équipe qui donne accès à sa conversation, pas le titre auquel on l'occupe.
 *
 * ⚠️ POURQUOI UNE VERSION EN LOT. L'ouverture de la discussion d'équipe appelait la version à une
 * personne pour CHACUN des membres acceptés, à chaque clic. Chaque appel coûtait de quatre à huit
 * requêtes, dont un `findMany` sur tous les fils privés de l'équipe avec leurs participants —
 * requête identique d'un membre au suivant. Pour une équipe de quarante personnes, un clic
 * valait ≈ 250 requêtes séquentielles.
 *
 * Ici, ce qui ne dépend pas du membre est chargé UNE fois : la conversation de groupe, ses
 * participants, les responsables de l'équipe, et les fils privés existants. Ne restent par membre
 * que les écritures réellement nécessaires. Une équipe déjà synchronisée coûte cinq requêtes.
 *
 * ⚠️ CE QUE CE RATTRAPAGE EST LE SEUL À FAIRE, et pourquoi on ne peut pas se contenter de
 * « n'appeler la synchronisation que pour les membres absents du groupe ». Les participants du
 * groupe sont bien posés à l'affectation (`teams.ts`), mais nommer un responsable ne passe PAS
 * par là : `setTeamLeader` se borne à écrire `isLeader`. Les fils privés « membre ⇄ responsables »
 * des membres déjà en place ne sont donc créés par personne — sauf ici. Sauter un membre au motif
 * qu'il est déjà participant du groupe lui retirerait son fil avec ses responsables, sans erreur
 * et sans que rien ne le signale. D'où le passage sur TOUS les membres, mais à coût constant.
 *
 * @param editionId - ID de l'édition
 * @param teamId - ID de l'équipe
 * @param userIds - les personnes concernées
 * @param tx - Transaction Prisma optionnelle
 */
export async function assurerConversationsEquipeDesMembres(
  editionId: number,
  teamId: string,
  userIds: number[],
  tx?: PrismaTransaction
) {
  const client = tx || prisma
  const membres = [...new Set(userIds)]
  if (membres.length === 0) return

  // 1. Créer ou récupérer la conversation de groupe de l'équipe
  let conversationDeGroupe = await client.conversation.findFirst({
    where: {
      editionId,
      teamId,
      type: 'TEAM_GROUP',
    },
  })

  if (!conversationDeGroupe) {
    conversationDeGroupe = await client.conversation.create({
      data: {
        editionId,
        teamId,
        type: 'TEAM_GROUP',
      },
    })
  }

  // Figé dans une constante : `conversationDeGroupe` est un `let`, et le typage le rend de nouveau
  // nullable dès qu'on le lit depuis une fermeture.
  const idDuGroupe = conversationDeGroupe.id

  // 2. Les participants du groupe, pour tous les membres à la fois
  const participants = await client.conversationParticipant.findMany({
    where: { conversationId: idDuGroupe, userId: { in: membres } },
    select: { id: true, userId: true, leftAt: true },
  })
  const dejaInscrits = new Set(participants.map((participant) => participant.userId))

  const aInscrire = membres.filter((userId) => !dejaInscrits.has(userId))
  if (aInscrire.length > 0) {
    /*
     * `skipDuplicates` : deux ouvertures simultanées de la même discussion d'équipe passeraient
     * ici avec la même liste. La contrainte d'unicité (conversationId, userId) ferait échouer la
     * seconde, et l'ouverture rendrait 500 à qui n'a rien fait de mal.
     */
    await client.conversationParticipant.createMany({
      data: aInscrire.map((userId) => ({ conversationId: idDuGroupe, userId })),
      skipDuplicates: true,
    })
  }

  // Ceux qui avaient été retirés de l'équipe puis réintégrés reprennent leur place. Une seule
  // écriture pour tout le monde — c'est `leftAt` qui gouverne la lecture du fil.
  const aReactiver = participants
    .filter((participant) => participant.leftAt)
    .map((participant) => participant.id)
  if (aReactiver.length > 0) {
    await client.conversationParticipant.updateMany({
      where: { id: { in: aReactiver } },
      data: { leftAt: null },
    })
  }

  // 3. Les responsables de l'équipe — bénévoles acceptés comme organisateurs rattachés, les deux
  // titres se valent. Une seule fois : ils sont les mêmes pour tous les membres.
  const responsables = await utilisateursResponsablesDeLEquipe(editionId, teamId, tx)
  if (responsables.length === 0) return

  // 4. Les fils privés déjà existants, avec leurs participants — une seule requête là où il y en
  // avait une par membre.
  const filsExistants: FilDeResponsables[] = await client.conversation.findMany({
    where: {
      editionId,
      teamId,
      type: 'TEAM_LEADER_PRIVATE',
    },
    select: {
      id: true,
      participants: { select: { id: true, userId: true, leftAt: true } },
    },
  })

  const participantsActifs = (fil: FilDeResponsables) =>
    fil.participants.filter((participant) => !participant.leftAt).map((p) => p.userId)

  for (const membre of membres) {
    // Le membre et ses responsables, lui-même retiré de la liste s'il en est.
    const attendus = new Set([membre, ...responsables.filter((chef) => chef !== membre)])

    // Seul responsable de son équipe : il n'a personne à qui écrire en privé.
    if (attendus.size === 1) continue

    /*
     * La reconnaissance se fait sur les participants ACTIFS, comme avant : un fil dont un
     * responsable est parti ne correspond plus, et un nouveau est créé à côté. C'est le
     * comportement existant, conservé tel quel.
     *
     * 📍 La version précédente portait, dans la branche « fil trouvé », une réactivation des
     * participants partis. Elle ne pouvait JAMAIS s'exécuter : si le fil correspond, c'est que ses
     * participants actifs sont exactement les attendus — donc tout participant marqué parti est
     * hors de cette liste, et la condition était toujours fausse. Elle n'est pas reprise ici. Le
     * défaut qu'elle visait (un fil abandonné et un doublon créé quand un responsable revient)
     * reste entier ; le traiter change la conversation où les gens atterrissent, donc c'est une
     * décision à part.
     */
    const fil = filsExistants.find((candidat) =>
      memeEnsemble(participantsActifs(candidat), attendus)
    )
    if (fil) continue

    const cree: FilDeResponsables = await client.conversation.create({
      data: {
        editionId,
        teamId,
        type: 'TEAM_LEADER_PRIVATE',
        participants: {
          create: [...attendus].map((userId) => ({ userId })),
        },
      },
      select: {
        id: true,
        participants: { select: { id: true, userId: true, leftAt: true } },
      },
    })

    /*
     * ⚠️ AJOUTER LE FIL CRÉÉ À LA LISTE EN MÉMOIRE, ET NON SEULEMENT EN BASE. Deux responsables
     * d'une même équipe attendent le MÊME fil : pour A, c'est {A, B} ; pour B, {B, A}. La version
     * à une personne relisait la base à chaque appel et retrouvait donc celui que l'appel
     * précédent venait de créer. Ici la liste est lue une seule fois — sans cette ligne, le second
     * responsable en créerait un DOUBLON, et les deux se retrouveraient chacun dans un fil
     * distinct où l'autre ne lirait jamais rien.
     */
    filsExistants.push(cree)
  }
}

/**
 * Crée ou récupère les conversations pour UNE personne rattachée à une équipe.
 *
 * Appelée à l'affectation d'un bénévole ou au rattachement d'un organisateur, où il n'y a qu'une
 * personne à traiter. Le travail est celui de [assurerConversationsEquipeDesMembres], dont ceci
 * n'est que le cas à un élément.
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
  await assurerConversationsEquipeDesMembres(editionId, teamId, [userId], tx)
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
    throw createError({ status: 404, message: 'Édition introuvable' })
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

  /*
   * Aucun organisateur ne gère les bénévoles sur cette édition : il n'y a personne à contacter.
   *
   * ⚠️ C'était un `throw new Error` nu, donc un 500 muet : le bénévole qui cliquait « contacter
   * les organisateurs » voyait une panne, là où la vraie réponse est « personne n'est joignable ».
   * Un 409 le dit, et l'écran affiche déjà les erreurs qu'on lui rend.
   */
  if (organizerUserIds.length === 0) {
    throw createError({
      status: 409,
      message: 'Aucun organisateur avec les droits de gestion des bénévoles trouvé',
    })
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
        // ⚠️ À QUI CE FIL APPARTIENT, inscrit dès la création. Les participants sont le bénévole ET
        // les organisateurs mélangés, et un organisateur peut être bénévole de la même édition :
        // sans cette colonne, retirer « ceux qui ne sont pas organisateurs » retirerait le
        // bénévole de sa propre conversation.
        volunteerId,
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

    /*
     * Rattrapage des fils créés avant l'existence de `volunteerId`. La migration de rattrapage en
     * a désigné la plupart, mais elle S'EST ABSTENUE là où la déduction était ambiguë — et ces
     * fils-là ne se répareraient jamais autrement. Ici, en revanche, on SAIT qui est le bénévole :
     * c'est le paramètre de cette fonction.
     */
    if (!existingConversation.volunteerId) {
      await client.conversation.update({
        where: { id: existingConversation.id },
        data: { volunteerId },
      })
      conversation = { ...existingConversation, volunteerId }
    }

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
 * Remet les participants des fils « bénévole ↔ organisateurs » d'une édition en accord avec les
 * droits du moment.
 *
 * ⚠️ POURQUOI C'EST NÉCESSAIRE, et pourquoi le défaut était invisible. La liste des participants
 * d'un fil est un INSTANTANÉ, pris quand le fil est créé ou quand un bénévole y revient.
 * `ensureVolunteerToOrganizersConversation` AJOUTE les organisateurs habilités et RÉACTIVE ceux
 * qui étaient partis — mais ne retire JAMAIS celui qui a perdu le droit.
 *
 * La dérive était donc à SENS UNIQUE : celui qui gagne le droit finit par être ajouté au prochain
 * passage du bénévole ; celui qui le PERD reste, et continue de lire les messages privés des
 * bénévoles aux organisateurs. Rien ne le signalait : ni erreur, ni journal — seulement un fil qui
 * reste ouvert dans sa messagerie.
 *
 * ⚠️ LE BÉNÉVOLE DU FIL EST ÉPARGNÉ, et c'est toute la raison d'être de `volunteerId`. Les
 * participants sont le bénévole ET les organisateurs, mélangés, et un organisateur peut lui-même
 * être bénévole de l'édition : retirer « ceux qui ne sont pas organisateurs habilités » le
 * couperait de sa propre conversation, en silence.
 *
 * ⚠️ UN FIL SANS PROPRIÉTAIRE EST ÉPARGNÉ AUSSI. La migration de rattrapage s'est abstenue là où
 * la déduction était ambiguë ; y synchroniser les participants reviendrait à deviner. La fuite y
 * persiste — c'est le prix assumé de ne couper personne par erreur, et elle se referme dès que le
 * bénévole repasse dans son fil, ce qui inscrit son identité.
 *
 * `leftAt` et non une suppression : l'historique doit rester lisible pour ceux qui y ont écrit, et
 * c'est déjà la règle du reste de la messagerie. Le contrôle d'accès lit ce champ.
 */
export async function synchroniserParticipantsDesFilsDeBenevoles(
  editionId: number,
  tx?: PrismaTransaction
): Promise<{ retires: number; reintegres: number }> {
  const client = tx || prisma

  const edition = await client.edition.findUnique({
    where: { id: editionId },
    select: { conventionId: true },
  })
  if (!edition) return { retires: 0, reintegres: 0 }

  /*
   * LA MÊME REQUÊTE que celle qui les ajoute, quelques dizaines de lignes plus haut : un membre de
   * la convention habilité à gérer les bénévoles, globalement ou sur cette édition. Deux
   * définitions divergentes de « qui a droit à ce fil » produiraient un va-et-vient — retiré par
   * l'une, réintégré par l'autre au passage suivant du bénévole.
   */
  const organisateurs = await client.conventionOrganizer.findMany({
    where: {
      conventionId: edition.conventionId,
      OR: [
        { canManageVolunteers: true },
        { perEditionPermissions: { some: { editionId, canManageVolunteers: true } } },
      ],
    },
    select: { userId: true },
  })
  const habilites = new Set(organisateurs.map((organisateur) => organisateur.userId))

  const fils = await client.conversation.findMany({
    where: {
      editionId,
      teamId: null,
      type: 'VOLUNTEER_TO_ORGANIZERS',
      // Les fils sans propriétaire connu sont laissés tels quels : voir l'en-tête.
      volunteerId: { not: null },
    },
    select: { id: true, volunteerId: true, participants: true },
  })

  let retires = 0
  let reintegres = 0

  for (const fil of fils) {
    for (const participant of fil.participants) {
      const aDroit = participant.userId === fil.volunteerId || habilites.has(participant.userId)

      if (!aDroit && !participant.leftAt) {
        await client.conversationParticipant.update({
          where: { id: participant.id },
          data: { leftAt: new Date() },
        })
        retires++
      } else if (aDroit && participant.leftAt) {
        /*
         * Le sens inverse : quelqu'un retiré par une révocation, puis réhabilité. Sans cette
         * branche, il faudrait attendre que le bénévole repasse dans son fil pour qu'il y revienne
         * — et il n'y repasse pas forcément.
         */
        await client.conversationParticipant.update({
          where: { id: participant.id },
          data: { leftAt: null },
        })
        reintegres++
      }
    }
  }

  return { retires, reintegres }
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

  // Même raison qu'au-dessus : une édition sans organisateur n'est pas une panne, c'est un refus.
  if (organizerUserIds.length === 0) {
    throw createError({ status: 409, message: 'Aucun organisateur trouvé pour cette édition' })
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
    throw createError({ status: 404, message: 'Candidature introuvable' })
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
    throw createError({ status: 404, message: 'Spectacle introuvable' })
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
