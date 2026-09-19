import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { updateUserInfo } from '#server/utils/editions/ticketing/user-info-update'
import { utilisateursResponsablesDeLEquipe } from '#server/utils/editions/volunteers/responsables-equipe'
import { NotificationHelpers, safeNotify } from '#server/utils/notification-service'
import { canAccessEditionDataOrAccessControl } from '#server/utils/permissions/edition-permissions'
import { journaliserMouvementDEntree } from '#server/utils/ticketing/journal-des-entrees'

const bodySchema = z.object({
  participantIds: z.array(z.number()).min(1),
  type: z.enum(['ticket', 'volunteer', 'artist', 'organizer']).optional().default('ticket'),
  paymentMethod: z.enum(['cash', 'card', 'check']).nullable().optional(),
  checkNumber: z.string().optional(),
  userInfo: z
    .object({
      firstName: z.string().nullable().optional(),
      lastName: z.string().nullable().optional(),
      email: z.string().email().nullable().optional(),
      phone: z.string().nullable().optional(),
    })
    .optional(),
})

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)

    // Vérifier les permissions (gestionnaires OU bénévoles en créneau actif de contrôle d'accès)
    const allowed = await canAccessEditionDataOrAccessControl(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message:
          "Droits insuffisants pour accéder à cette fonctionnalité - vous devez être gestionnaire ou en créneau actif de contrôle d'accès",
      })

    const body = bodySchema.parse(await readBody(event))

    try {
      if (body.type === 'volunteer') {
        // Valider les bénévoles
        const updateData: {
          entryValidated: boolean
          entryValidatedAt: Date
          entryValidatedBy: number
          userSnapshotPhone?: string | null
        } = {
          entryValidated: true,
          entryValidatedAt: new Date(),
          entryValidatedBy: user.id,
        }

        // Mettre à jour le téléphone snapshot si fourni
        if (body.userInfo?.phone !== undefined) {
          updateData.userSnapshotPhone = body.userInfo.phone
        }

        // Qui sera réellement validé — relevé AVANT la mise à jour, parce qu'`updateMany` ne
        // rend qu'un compte. Le journal doit nommer les lignes qui ont bougé, et non celles qu'on
        // avait demandées : celles déjà validées sont écartées par le même critère.
        const critereVolunteer = {
          id: {
            in: body.participantIds,
          },
          eventId: editionId,
          status: 'ACCEPTED' as const,
          entryValidated: false,
        }
        const aValider = await prisma.editionVolunteerApplication.findMany({
          where: critereVolunteer,
          select: { id: true },
        })

        const result = await prisma.editionVolunteerApplication.updateMany({
          where: critereVolunteer,
          data: updateData,
        })

        // Mettre à jour les informations utilisateur si fournies
        if (body.userInfo && Object.keys(body.userInfo).length > 0) {
          // Récupérer les applications pour obtenir les userIds
          const applications = await prisma.editionVolunteerApplication.findMany({
            where: {
              id: {
                in: body.participantIds,
              },
              eventId: editionId,
            },
            select: {
              userId: true,
            },
          })

          const userIds = applications.map((app) => app.userId)

          // Mettre à jour les informations utilisateur
          await updateUserInfo(userIds, body.userInfo)
        }

        // Envoyer des notifications uniquement si de nouvelles validations ont été effectuées
        if (result.count > 0) {
          // Envoyer des notifications aux responsables d'équipes
          // Pour chaque bénévole validé
          for (const applicationId of body.participantIds) {
            try {
              // Récupérer les informations du bénévole et ses équipes
              const application = await prisma.editionVolunteerApplication.findUnique({
                where: { id: applicationId },
                include: {
                  user: {
                    select: {
                      id: true,
                      pseudo: true,
                      prenom: true,
                      nom: true,
                    },
                  },
                  teamAssignments: {
                    include: {
                      team: {
                        select: {
                          id: true,
                          name: true,
                          // Récupérer les leaders de l'équipe via ApplicationTeamAssignment
                        },
                      },
                    },
                  },
                },
              })

              if (!application) continue

              // Pour chaque équipe du bénévole
              for (const teamAssignment of application.teamAssignments) {
                // Les responsables de cette équipe : bénévoles acceptés comme organisateurs
                // rattachés, les deux titres se valent pour être prévenu.
                const leaderUserIds = await utilisateursResponsablesDeLEquipe(
                  editionId,
                  teamAssignment.teamId
                )

                // Envoyer une notification à chaque leader
                for (const leaderUserId of leaderUserIds) {
                  const volunteerName =
                    `${application.user.prenom || ''} ${application.user.nom || ''}`.trim() ||
                    application.user.pseudo

                  await safeNotify(
                    () =>
                      NotificationHelpers.volunteerArrival(
                        leaderUserId,
                        volunteerName,
                        application.user.pseudo,
                        teamAssignment.team.name,
                        editionId,
                        application.id
                      ),
                    'notification arrivée bénévole'
                  )
                }
              }
            } catch (notifError) {
              // Ne pas bloquer la validation si l'envoi de notification échoue
              console.error(
                `Erreur lors de l'envoi de notification pour le bénévole ${applicationId}:`,
                notifError
              )
            }
          }

          // Notifier via SSE
          try {
            const { broadcastToEditionSSE } = await import('#server/utils/sse-manager')
            for (const participantId of body.participantIds) {
              broadcastToEditionSSE(editionId, {
                type: 'entry-validated',
                editionId,
                participantType: 'volunteer',
                participantId,
              })
            }
            // Notifier aussi que les stats ont changé
            broadcastToEditionSSE(editionId, {
              type: 'stats-updated',
              editionId,
            })
          } catch (sseError) {
            console.error('[SSE] Failed to notify SSE clients:', sseError)
          }
        } // fin if (result.count > 0)

        await journaliserMouvementDEntree({
          editionId,
          type: 'volunteer',
          participantIds: aValider.map((ligne) => ligne.id),
          mouvement: 'VALIDATED',
          actorId: user.id,
        })

        return createSuccessResponse({ validated: result.count, type: 'volunteer' })
      } else if (body.type === 'artist') {
        // Valider les artistes
        // Qui sera réellement validé — relevé AVANT la mise à jour, parce qu'`updateMany` ne
        // rend qu'un compte. Le journal doit nommer les lignes qui ont bougé, et non celles qu'on
        // avait demandées : celles déjà validées sont écartées par le même critère.
        const critereArtist = {
          id: {
            in: body.participantIds,
          },
          editionId: editionId,
          entryValidated: false,
        }
        const aValider = await prisma.editionArtist.findMany({
          where: critereArtist,
          select: { id: true },
        })

        const result = await prisma.editionArtist.updateMany({
          where: critereArtist,
          data: {
            entryValidated: true,
            entryValidatedAt: new Date(),
            entryValidatedBy: user.id,
          },
        })

        // Mettre à jour les informations utilisateur si fournies
        if (body.userInfo && Object.keys(body.userInfo).length > 0) {
          // Récupérer les artistes pour obtenir leurs userIds
          const artists = await prisma.editionArtist.findMany({
            where: {
              id: {
                in: body.participantIds,
              },
              editionId: editionId,
            },
            select: {
              userId: true,
            },
          })

          const userIds = artists.map((artist) => artist.userId)

          // Mettre à jour les informations utilisateur
          await updateUserInfo(userIds, body.userInfo)
        }

        // Envoyer des notifications uniquement si de nouvelles validations ont été effectuées
        if (result.count > 0) {
          // Envoyer des notifications aux responsables artistes
          // Pour chaque artiste validé
          for (const artistId of body.participantIds) {
            try {
              // Récupérer les informations de l'artiste et ses spectacles
              const artist = await prisma.editionArtist.findUnique({
                where: { id: artistId },
                include: {
                  user: {
                    select: {
                      id: true,
                      pseudo: true,
                      prenom: true,
                      nom: true,
                    },
                  },
                  // distinct : un artiste jouant dans plusieurs numéros d'un cabaret a autant de
                  // liens ShowArtist pour le même spectacle, qui apparaîtrait sinon en double
                  shows: {
                    distinct: ['showId'],
                    include: {
                      show: {
                        select: {
                          id: true,
                          title: true,
                        },
                      },
                    },
                  },
                },
              })

              if (!artist) continue

              /*
               * Les organisateurs habilités à gérer les artistes, pour les prévenir de l'arrivée.
               *
               * ⚠️ Ce n'est PAS `EditionOrganizer` : ce modèle décrit un organisateur PRÉSENT sur
               * l'édition — son QR code, sa validation d'entrée — et ne porte ni `userId` ni
               * droits. La requête précédente nommait les deux, et Prisma refusait donc la
               * requête entière : scanner le billet d'un artiste rendait 500.
               *
               * Le droit vit à deux endroits, comme partout ailleurs dans le dépôt : sur
               * l'organisateur de la CONVENTION, et sur la permission propre à l'ÉDITION. Voir
               * `canManageArtistsById`, dont c'est la même lecture.
               */
              const habilitations = await prisma.edition.findUnique({
                where: { id: editionId },
                select: {
                  creatorId: true,
                  convention: {
                    select: {
                      authorId: true,
                      organizers: {
                        where: { canManageArtists: true },
                        select: { userId: true },
                      },
                    },
                  },
                  organizerPermissions: {
                    where: { canManageArtists: true },
                    select: { organizer: { select: { userId: true } } },
                  },
                },
              })

              // Le créateur de l'édition et l'auteur de la convention en répondent aussi, sans
              // qu'aucune case ne soit cochée. Un `Set` évite de notifier deux fois qui cumule.
              const artistManagers = [
                ...new Set(
                  [
                    habilitations?.creatorId,
                    habilitations?.convention?.authorId,
                    ...(habilitations?.convention?.organizers ?? []).map((o) => o.userId),
                    ...(habilitations?.organizerPermissions ?? []).map((p) => p.organizer?.userId),
                  ].filter((id): id is number => typeof id === 'number')
                ),
              ].map((userId) => ({ userId }))

              // Construire le nom de l'artiste
              const artistName =
                `${artist.user.prenom || ''} ${artist.user.nom || ''}`.trim() || artist.user.pseudo

              // Construire la liste des spectacles
              const shows = artist.shows.map((showArtist) => showArtist.show.title)

              // Envoyer une notification à chaque responsable artiste
              const { NotificationHelpers } = await import('#server/utils/notification-service')
              for (const manager of artistManagers) {
                await NotificationHelpers.artistArrival(
                  manager.userId,
                  artistName,
                  editionId,
                  artist.id,
                  shows.length > 0 ? shows : undefined
                )
              }
            } catch (notifError) {
              // Ne pas bloquer la validation si l'envoi de notification échoue
              console.error(
                `Erreur lors de l'envoi de notification pour l'artiste ${artistId}:`,
                notifError
              )
            }
          }

          // Notifier via SSE
          try {
            const { broadcastToEditionSSE } = await import('#server/utils/sse-manager')
            for (const participantId of body.participantIds) {
              broadcastToEditionSSE(editionId, {
                type: 'entry-validated',
                editionId,
                participantType: 'artist',
                participantId,
              })
            }
            // Notifier aussi que les stats ont changé
            broadcastToEditionSSE(editionId, {
              type: 'stats-updated',
              editionId,
            })
          } catch (sseError) {
            console.error('[SSE] Failed to notify SSE clients:', sseError)
          }
        } // fin if (result.count > 0)

        await journaliserMouvementDEntree({
          editionId,
          type: 'artist',
          participantIds: aValider.map((ligne) => ligne.id),
          mouvement: 'VALIDATED',
          actorId: user.id,
        })

        return createSuccessResponse({ validated: result.count, type: 'artist' })
      } else if (body.type === 'organizer') {
        // Valider les organisateurs
        // Les participantIds sont les IDs des EditionOrganizer
        // Qui sera réellement validé — relevé AVANT la mise à jour, parce qu'`updateMany` ne
        // rend qu'un compte. Le journal doit nommer les lignes qui ont bougé, et non celles qu'on
        // avait demandées : celles déjà validées sont écartées par le même critère.
        const critereOrganizer = {
          id: {
            in: body.participantIds,
          },
          editionId: editionId,
          entryValidated: false,
        }
        const aValider = await prisma.editionOrganizer.findMany({
          where: critereOrganizer,
          select: { id: true },
        })

        const result = await prisma.editionOrganizer.updateMany({
          where: critereOrganizer,
          data: {
            entryValidated: true,
            entryValidatedAt: new Date(),
            entryValidatedBy: user.id,
          },
        })

        // Mettre à jour les informations utilisateur si fournies
        if (body.userInfo && Object.keys(body.userInfo).length > 0) {
          // Récupérer les organisateurs pour obtenir leurs userIds
          const editionOrganizers = await prisma.editionOrganizer.findMany({
            where: {
              id: {
                in: body.participantIds,
              },
              editionId: editionId,
            },
            include: {
              organizer: {
                select: {
                  userId: true,
                },
              },
            },
          })

          const userIds = editionOrganizers.map((eo) => eo.organizer.userId)

          // Mettre à jour les informations utilisateur
          await updateUserInfo(userIds, body.userInfo)
        }

        // Notifier via SSE uniquement si de nouvelles validations ont été effectuées
        if (result.count > 0) {
          try {
            const { broadcastToEditionSSE } = await import('#server/utils/sse-manager')
            for (const participantId of body.participantIds) {
              broadcastToEditionSSE(editionId, {
                type: 'entry-validated',
                editionId,
                participantType: 'organizer',
                participantId,
              })
            }
            // Notifier aussi que les stats ont changé
            broadcastToEditionSSE(editionId, {
              type: 'stats-updated',
              editionId,
            })
          } catch (sseError) {
            console.error('[SSE] Failed to notify SSE clients:', sseError)
          }
        } // fin if (result.count > 0)

        await journaliserMouvementDEntree({
          editionId,
          type: 'organizer',
          participantIds: aValider.map((ligne) => ligne.id),
          mouvement: 'VALIDATED',
          actorId: user.id,
        })

        return createSuccessResponse({ validated: result.count, type: 'organizer' })
      } else {
        // Vérifier si des billets appartiennent à des commandes remboursées
        const refundedItems = await prisma.ticketingOrderItem.findMany({
          where: {
            id: { in: body.participantIds },
            order: { editionId: editionId },
            OR: [{ state: 'Refunded' }, { order: { status: 'Refunded' } }],
          },
          select: { id: true },
        })

        if (refundedItems.length > 0) {
          throw createError({
            status: 400,
            message:
              refundedItems.length === body.participantIds.length
                ? 'Ce billet a été remboursé et ne peut pas être validé'
                : `${refundedItems.length} billet(s) remboursé(s) ne peuvent pas être validés`,
          })
        }

        // Valider les billets en utilisant l'ID de OrderItem
        // Qui sera réellement validé — relevé AVANT la mise à jour, parce qu'`updateMany` ne
        // rend qu'un compte. Le journal doit nommer les lignes qui ont bougé, et non celles qu'on
        // avait demandées : celles déjà validées sont écartées par le même critère.
        const critereTicket = {
          id: {
            in: body.participantIds,
          },
          order: {
            editionId: editionId,
          },
          entryValidated: false,
        }
        const aValider = await prisma.ticketingOrderItem.findMany({
          where: critereTicket,
          select: { id: true },
        })

        const result = await prisma.ticketingOrderItem.updateMany({
          where: critereTicket,
          data: {
            entryValidated: true,
            entryValidatedAt: new Date(),
            entryValidatedBy: user.id,
          },
        })

        // Si le paiement est confirmé, mettre à jour le statut de la commande et des items
        if (body.paymentMethod) {
          // Récupérer les items validés pour obtenir les IDs de commandes
          const validatedItems = await prisma.ticketingOrderItem.findMany({
            where: {
              id: {
                in: body.participantIds,
              },
            },
            select: {
              orderId: true,
              state: true,
            },
          })

          // Extraire les IDs uniques des commandes
          const orderIds = [...new Set(validatedItems.map((item) => item.orderId))]

          // Transaction atomique pour mettre à jour commandes et items ensemble
          await prisma.$transaction([
            prisma.ticketingOrder.updateMany({
              where: {
                id: {
                  in: orderIds,
                },
                status: 'Pending',
              },
              data: {
                status: 'Onsite',
                paymentMethod: body.paymentMethod,
                checkNumber: body.paymentMethod === 'check' ? body.checkNumber : null,
              },
            }),
            prisma.ticketingOrderItem.updateMany({
              where: {
                id: {
                  in: body.participantIds,
                },
                state: 'Pending',
              },
              data: {
                state: 'Processed',
              },
            }),
          ])
        }

        // Notifier via SSE uniquement si de nouvelles validations ont été effectuées
        if (result.count > 0) {
          try {
            const { broadcastToEditionSSE } = await import('#server/utils/sse-manager')
            for (const participantId of body.participantIds) {
              broadcastToEditionSSE(editionId, {
                type: 'entry-validated',
                editionId,
                participantType: 'ticket',
                participantId,
              })
            }
            // Notifier aussi que les stats ont changé
            broadcastToEditionSSE(editionId, {
              type: 'stats-updated',
              editionId,
            })
          } catch (sseError) {
            console.error('[SSE] Failed to notify SSE clients:', sseError)
          }
        } // fin if (result.count > 0)

        await journaliserMouvementDEntree({
          editionId,
          type: 'ticket',
          participantIds: aValider.map((ligne) => ligne.id),
          mouvement: 'VALIDATED',
          actorId: user.id,
        })

        return createSuccessResponse({ validated: result.count, type: 'ticket' })
      }
    } catch (error: unknown) {
      console.error('Database validate entry error:', error)
      throw createError({
        status: 500,
        message: 'Erreur lors de la validation des entrées',
      })
    }
  },
  { operationName: 'POST ticketing validate-entry' }
)
