import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getUserAvatarUrl } from '#server/utils/avatar-url'
import { utilisateursResponsablesDeLEquipe } from '#server/utils/editions/volunteers/responsables-equipe'
import { masquerMessageSupprime } from '#server/utils/messenger-message-affiche'
import {
  messengerStreamService,
  messengerUnreadService,
} from '#server/utils/messenger-unread-service'
import { notificationAutoriseeDapres } from '#server/utils/notification-preferences'
import { messengerMessageInclude } from '#server/utils/prisma-select-helpers'
import { translateServerSide } from '#server/utils/server-i18n'
import { unifiedPushService } from '#server/utils/unified-push-service'

const bodySchema = z.object({
  content: z.string().min(1).max(10000),
  replyToId: z.string().optional(), // ID du message auquel on répond
})

/**
 * POST /api/messenger/conversations/[conversationId]/messages
 * Envoie un nouveau message dans une conversation
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conversationId = getRouterParam(event, 'conversationId')!
    const body = await readBody(event)
    const { content, replyToId } = bodySchema.parse(body)

    // Vérifier que l'utilisateur est participant de cette conversation
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId: user.id,
        leftAt: null,
      },
      include: {
        conversation: {
          include: {
            team: {
              select: {
                name: true,
              },
            },
            edition: {
              select: {
                id: true,
                name: true,
                convention: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            showApplication: {
              select: {
                id: true,
                showCall: {
                  select: {
                    edition: {
                      select: {
                        id: true,
                        name: true,
                        convention: {
                          select: {
                            name: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            // Le titre du spectacle nomme la notification d'un groupe SHOW_GROUP
            show: {
              select: {
                title: true,
              },
            },
            participants: {
              where: {
                leftAt: null,
                userId: {
                  not: user.id, // Tous les participants sauf l'envoyeur
                },
              },
              select: {
                userId: true,
              },
            },
          },
        },
      },
    })

    if (!participant) {
      throw createError({
        status: 403,
        message: "Vous n'avez pas accès à cette conversation",
      })
    }

    // Si replyToId est fourni, vérifier que le message existe et appartient à la même conversation
    if (replyToId) {
      const replyToMessage = await prisma.message.findFirst({
        where: {
          id: replyToId,
          conversationId,
        },
      })

      if (!replyToMessage) {
        throw createError({
          status: 400,
          message: "Le message auquel vous tentez de répondre n'existe pas dans cette conversation",
        })
      }
    }

    // Créer le message
    const message = await prisma.message.create({
      data: {
        conversationId,
        participantId: participant.id,
        // Pas d'échappement HTML : le contenu est affiché via interpolation texte
        // ({{ }}, échappée par Vue) et envoyé en notifications push en texte brut.
        // Cohérent avec l'édition de message (PATCH) qui stocke aussi le texte brut.
        content: content.trim(),
        replyToId,
      },
      include: messengerMessageInclude,
    })

    // Mettre à jour la conversation (updatedAt)
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    // Envoyer des notifications push aux autres participants (uniquement s'ils ne sont pas sur la page)
    const teamName = participant.conversation.team?.name
    const conversationType = participant.conversation.type
    // Pour ARTIST_APPLICATION, l'édition est via showApplication.showCall.edition
    const showApplication = participant.conversation.showApplication
    const editionFromShowApplication = showApplication?.showCall.edition
    const editionName = participant.conversation.edition?.name ?? editionFromShowApplication?.name
    const editionId = participant.conversation.edition?.id ?? editionFromShowApplication?.id
    const conventionName =
      participant.conversation.edition?.convention?.name ??
      editionFromShowApplication?.convention?.name
    const showTitle = participant.conversation.show?.title

    const truncatedContent = content.length > 100 ? content.substring(0, 97) + '...' : content

    // Récupérer tous les participants avec leur lastReadMessageId et leurs rôles pour déterminer le titre de notification
    // Pour les conversations privées, on n'a pas besoin des infos d'organisation/bénévolat
    const teamId = participant.conversation.teamId
    const participantsWithReadStatus = await prisma.conversationParticipant.findMany({
      where: {
        conversationId,
        leftAt: null,
        userId: {
          not: user.id, // Tous les participants sauf l'envoyeur
        },
      },
      select: {
        userId: true,
        lastReadMessageId: true,
        user: {
          select: {
            pseudo: true,
            /*
             * La langue du destinataire, et non celle de l'expéditeur : le titre de la
             * notification était écrit en français dans le code, si bien qu'un bénévole
             * néerlandais recevait « Nouveau message d'un responsable Accueil ». Le corps de
             * l'application est traduit depuis longtemps ; c'est la notification — la seule chose
             * qu'il voit quand il n'a pas l'application ouverte — qui restait en français.
             */
            preferredLanguage: true,
            /*
             * ⚠️ LA PRÉFÉRENCE EST LUE ICI, dans le `select` qui ramène déjà les participants, et
             * NON par un appel à `isNotificationAllowed` dans la boucle : ce serait une requête
             * par destinataire, à chaque message. Une équipe de quarante personnes paierait
             * quarante allers-retours pour décider d'envoyer un push.
             */
            notificationPreferences: true,
            // Uniquement pour les conversations liées à une édition
            ...(editionId
              ? {
                  organizations: {
                    where: {
                      convention: {
                        editions: {
                          some: {
                            id: editionId,
                          },
                        },
                      },
                    },
                    select: {
                      id: true,
                    },
                  },
                }
              : {}),
          },
        },
      },
    })

    // Responsables de l'équipe, bénévoles comme organisateurs : le titre de la notification
    // s'en déduit, et l'annoncer de travers désigne la mauvaise personne.
    const responsablesEquipe =
      teamId && editionId
        ? new Set(await utilisateursResponsablesDeLEquipe(editionId, teamId))
        : new Set<number>()

    await Promise.all(
      participantsWithReadStatus.map(async (p) => {
        try {
          /*
           * ⚠️ LE SEUL ENDROIT OÙ LA PRÉFÉRENCE DE MESSAGERIE EST RESPECTÉE. Les messages
           * n'appellent pas `NotificationService.create` — ils poussent directement —, donc
           * aucune des six autres préférences ne les couvrait : un membre d'une équipe de
           * quarante personnes actives recevait un push par message de groupe, sans autre issue
           * que de couper tout le push de son compte.
           *
           * Le contrôle vient AVANT la composition du titre : traduire et calculer une URL pour
           * une notification qu'on ne va pas envoyer serait du travail perdu.
           */
          const preferencesDuDestinataire = (p.user as { notificationPreferences?: unknown })
            .notificationPreferences
          if (!notificationAutoriseeDapres(preferencesDuDestinataire, 'messengerMessages')) {
            return
          }

          // On envoie toujours la push : la distinction premier-plan / arrière-plan est
          // gérée par FCM côté client, par appareil (service worker en arrière-plan,
          // onMessage au premier plan). L'ancien filtrage par « présence SSE » était par
          // utilisateur et sans expiration : il supprimait les push sur les autres
          // appareils du destinataire (et indéfiniment en cas de connexion SSE perdue).

          /*
           * ⚠️ LE TITRE SE TRADUIT DANS LA LANGUE DU DESTINATAIRE, pas dans celle du code.
           *
           * Les huit variantes étaient des gabarits français écrits en dur. Le corps de
           * l'application est traduit en treize langues ; la notification push — la seule chose
           * qu'on voit quand l'application n'est pas ouverte — restait en français pour tout le
           * monde. Le repli sur `'fr'` couvre un compte qui n'a pas choisi de langue.
           *
           * Les clés vivent dans les `messenger.json` de `apps/app1/i18n/locales`, et NON dans un
           * layer :
           * `translateServerSide` ne lit que `apps/app1/i18n/locales`, et l'image de production ne
           * contient même pas les locales des layers. Une clé de layer rendrait la clé elle-même,
           * sans erreur ni trace.
           */
          const langue = (p.user as { preferredLanguage?: string | null }).preferredLanguage || 'fr'
          const traduire = (cle: string, params: Record<string, unknown> = {}) =>
            translateServerSide(cle, params, langue)

          let notificationTitle: string

          // Pour les conversations privées 1-à-1 (sans édition)
          if (conversationType === 'PRIVATE') {
            notificationTitle = traduire('messenger.push.private', { pseudo: user.pseudo })
          } else {
            // Pour les conversations liées à une édition
            const userWithOrgs = p.user as {
              pseudo: string
              organizations?: { id: number }[]
            }
            const isOrganizer = userWithOrgs.organizations?.length ?? 0 > 0

            const isTeamLeader = responsablesEquipe.has(p.userId)

            if (conversationType === 'TEAM_GROUP') {
              // Pour un groupe d'équipe, même titre pour tout le monde
              notificationTitle = traduire('messenger.push.team_group', { teamName, editionName })
            } else if (conversationType === 'TEAM_LEADER_PRIVATE') {
              /*
               * Le rôle du DESTINATAIRE décide du titre : un responsable lit « message d'un
               * bénévole », un bénévole lit « message d'un responsable ». L'annoncer de travers
               * désigne la mauvaise personne.
               */
              notificationTitle = traduire(
                isTeamLeader
                  ? 'messenger.push.team_leader_from_volunteer'
                  : 'messenger.push.team_leader_from_leader',
                { teamName, editionName }
              )
            } else if (conversationType === 'VOLUNTEER_TO_ORGANIZERS') {
              notificationTitle = traduire(
                isOrganizer
                  ? 'messenger.push.volunteer_to_organizers_from_volunteer'
                  : 'messenger.push.volunteer_to_organizers_from_organizer',
                { editionName }
              )
            } else if (conversationType === 'ORGANIZERS_GROUP') {
              notificationTitle = traduire('messenger.push.organizers_group', { editionName })
            } else if (conversationType === 'ARTIST_APPLICATION') {
              notificationTitle = traduire('messenger.push.artist_application', {
                conventionName: conventionName ?? '',
              })
            } else if (conversationType === 'SHOW_GROUP') {
              // Pour le groupe d'un spectacle, son titre situe la conversation mieux que
              // le nom de l'édition, un artiste pouvant jouer dans plusieurs spectacles
              notificationTitle = traduire('messenger.push.show_group', {
                title: showTitle ?? editionName,
              })
            } else {
              // Fallback
              notificationTitle = traduire('messenger.push.fallback', { editionName })
            }
          }

          // Générer l'URL de l'avatar de l'expéditeur
          const config = useRuntimeConfig()
          const baseUrl = config.public.siteUrl || 'https://juggling-convention.com'
          const senderUser = message.participant.user
          const senderAvatarUrl = getUserAvatarUrl(
            {
              id: senderUser.id,
              emailHash: senderUser.emailHash,
              profilePicture: senderUser.profilePicture,
            },
            baseUrl,
            96
          )

          // Envoyer la notification push (le service unifié gère les logs)
          // Pour les messages, l'icon est l'avatar de l'expéditeur
          // L'URL de la notification dépend du type de conversation
          let notificationUrl: string
          if (conversationType === 'ARTIST_APPLICATION' && showApplication?.id) {
            // Pour les candidatures artistes, pointer vers la page "Mes candidatures"
            notificationUrl = `/profile/mes-candidatures-artiste?applicationId=${showApplication.id}`
          } else if (editionId) {
            notificationUrl = `/messenger?editionId=${editionId}&conversationId=${conversationId}`
          } else {
            notificationUrl = `/messenger?conversationId=${conversationId}`
          }

          await unifiedPushService.sendToUser(p.userId, {
            title: notificationTitle,
            message: `${user.pseudo}: ${truncatedContent}`,
            url: notificationUrl,
            actionText: traduire('messenger.push.action'),
            icon: senderAvatarUrl, // Avatar de l'expéditeur comme icon principal
            badge: '/favicons/notification-badge.png',
          })
        } catch (error) {
          console.error(
            `Erreur lors de l'envoi de la notification push à l'utilisateur ${p.userId}:`,
            error
          )
        }
      })
    )

    // La forme que voit un participant, calculée une fois : elle sert à la réponse ET à la
    // diffusion, qui doivent être identiques.
    const messageAffiche = masquerMessageSupprime(message)

    // Envoyer les événements SSE aux autres participants
    const otherParticipantIds = participantsWithReadStatus.map((p) => p.userId)
    if (otherParticipantIds.length > 0) {
      // Données du nouveau message pour le stream SSE
      const newMessageData = {
        conversationId,
        messageId: message.id,
        content: message.content,
        createdAt: message.createdAt,
        senderId: user.id,
        senderPseudo: user.pseudo,
      }

      // Exécuter en arrière-plan sans bloquer la réponse
      Promise.all([
        // Envoyer la notification de nouveau message
        messengerStreamService.sendNewMessageToUsers(otherParticipantIds, newMessageData),
        /*
         * Et le message COMPLET, à la forme exacte de cette réponse.
         *
         * C'est ce qui remplace le sondage du flux par conversation : celui-ci interrogeait la
         * base toutes les cinq secondes, par connexion ouverte, pour retrouver un message que
         * l'on tient déjà ici. Les deux événements partent ensemble et ne se recouvrent pas —
         * `messenger_new_message` porte un résumé pour la pastille et l'aperçu, partout dans
         * l'application ; celui-ci porte le message entier, pour la conversation OUVERTE.
         *
         * `masquerMessageSupprime` plutôt qu'un `participantId` retiré à la main : la forme vue
         * par un participant a un seul endroit, et diffuser une autre forme que celle du GET
         * ferait apparaître à l'écran un message différent de celui qu'un rechargement montre.
         */
        messengerStreamService.sendMessageToUsers(otherParticipantIds, messageAffiche),
        // Envoyer le compteur de messages non lus mis à jour
        messengerUnreadService.sendUnreadCountToUsers(otherParticipantIds),
      ]).catch((error) => {
        console.error('[Messenger] Erreur lors de la mise à jour SSE:', error)
      })
    }

    return createSuccessResponse(messageAffiche)
  },
  { operationName: 'SendMessage' }
)
