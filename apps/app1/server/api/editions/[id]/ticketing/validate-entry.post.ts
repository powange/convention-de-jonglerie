import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { updateUserInfo } from '#server/utils/editions/ticketing/user-info-update'
import { utilisateursResponsablesDeLEquipe } from '#server/utils/editions/volunteers/responsables-equipe'
import { NotificationHelpers, safeNotify } from '#server/utils/notification-service'
import { canAccessEditionDataOrAccessControl } from '#server/utils/permissions/edition-permissions'
import { billetAnnule } from '#server/utils/ticketing/billets-qui-comptent'
import { journaliserMouvementDEntree } from '#server/utils/ticketing/journal-des-entrees'
import { departagerLesEntrees } from '#server/utils/ticketing/mouvement-de-validation'
import { schemaAdresseEmail } from '~~/shared/utils/adresse-email'

const bodySchema = z.object({
  participantIds: z.array(z.number()).min(1),
  type: z.enum(['ticket', 'volunteer', 'artist', 'organizer']).optional().default('ticket'),
  paymentMethod: z.enum(['cash', 'card', 'check']).nullable().optional(),
  checkNumber: z.string().optional(),
  userInfo: z
    .object({
      firstName: z.string().nullable().optional(),
      lastName: z.string().nullable().optional(),
      email: schemaAdresseEmail.nullable().optional(),
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

    /**
     * L'instant de CETTE validation, fabriqué une fois et écrit tel quel dans les quatre branches.
     *
     * C'est la signature de l'appel : relues après la mise à jour, les lignes qui portent cet
     * horodatage et cet auteur sont exactement celles qu'il a fait passer. Un `new Date()` posé
     * dans chaque `data` aurait rendu ce départage impossible.
     */
    const horodatage = new Date()

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
          entryValidatedAt: horodatage,
          entryValidatedBy: user.id,
        }

        // Mettre à jour le téléphone snapshot si fourni
        if (body.userInfo?.phone !== undefined) {
          updateData.userSnapshotPhone = body.userInfo.phone
        }

        // La portée, sans condition sur l'état : elle sert au `where` de la mise à jour (auquel
        // on ajoute `entryValidated: false`, qui rend le double scan atomique) ET à la relecture
        // qui départage ensuite ce qu'on a validé de ce qu'un autre avait déjà validé.
        const porteeVolunteer = {
          id: {
            in: body.participantIds,
          },
          eventId: editionId,
          status: 'ACCEPTED' as const,
        }

        const result = await prisma.editionVolunteerApplication.updateMany({
          where: { ...porteeVolunteer, entryValidated: false },
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

        const constat = await departagerLesEntrees({
          lignes: await prisma.editionVolunteerApplication.findMany({
            where: porteeVolunteer,
            select: {
              id: true,
              entryValidated: true,
              entryValidatedAt: true,
              entryValidatedBy: true,
            },
          }),
          horodatage,
          actorId: user.id,
        })

        await journaliserMouvementDEntree({
          editionId,
          type: 'volunteer',
          participantIds: constat.validees,
          mouvement: 'VALIDATED',
          actorId: user.id,
        })

        return createSuccessResponse({
          validated: result.count,
          type: 'volunteer',
          alreadyValidated: constat.dejaValidees,
        })
      } else if (body.type === 'artist') {
        // Valider les artistes
        // La portée, sans condition sur l'état : elle sert au `where` de la mise à jour (auquel
        // on ajoute `entryValidated: false`, qui rend le double scan atomique) ET à la relecture
        // qui départage ensuite ce qu'on a validé de ce qu'un autre avait déjà validé.
        const porteeArtist = {
          id: {
            in: body.participantIds,
          },
          editionId: editionId,
        }

        const result = await prisma.editionArtist.updateMany({
          where: { ...porteeArtist, entryValidated: false },
          data: {
            entryValidated: true,
            entryValidatedAt: horodatage,
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

        const constat = await departagerLesEntrees({
          lignes: await prisma.editionArtist.findMany({
            where: porteeArtist,
            select: {
              id: true,
              entryValidated: true,
              entryValidatedAt: true,
              entryValidatedBy: true,
            },
          }),
          horodatage,
          actorId: user.id,
        })

        await journaliserMouvementDEntree({
          editionId,
          type: 'artist',
          participantIds: constat.validees,
          mouvement: 'VALIDATED',
          actorId: user.id,
        })

        return createSuccessResponse({
          validated: result.count,
          type: 'artist',
          alreadyValidated: constat.dejaValidees,
        })
      } else if (body.type === 'organizer') {
        // Valider les organisateurs
        // Les participantIds sont les IDs des EditionOrganizer
        // La portée, sans condition sur l'état : elle sert au `where` de la mise à jour (auquel
        // on ajoute `entryValidated: false`, qui rend le double scan atomique) ET à la relecture
        // qui départage ensuite ce qu'on a validé de ce qu'un autre avait déjà validé.
        const porteeOrganizer = {
          id: {
            in: body.participantIds,
          },
          editionId: editionId,
        }

        const result = await prisma.editionOrganizer.updateMany({
          where: { ...porteeOrganizer, entryValidated: false },
          data: {
            entryValidated: true,
            entryValidatedAt: horodatage,
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

        const constat = await departagerLesEntrees({
          lignes: await prisma.editionOrganizer.findMany({
            where: porteeOrganizer,
            select: {
              id: true,
              entryValidated: true,
              entryValidatedAt: true,
              entryValidatedBy: true,
            },
          }),
          horodatage,
          actorId: user.id,
        })

        await journaliserMouvementDEntree({
          editionId,
          type: 'organizer',
          participantIds: constat.validees,
          mouvement: 'VALIDATED',
          actorId: user.id,
        })

        return createSuccessResponse({
          validated: result.count,
          type: 'organizer',
          alreadyValidated: constat.dejaValidees,
        })
      } else {
        // Les billets qui ne donnent plus droit d'entrée.
        //
        // Cette garde visait `state: 'Refunded'` — une valeur qu'AUCUNE ligne ne porte : l'état
        // d'annulation réellement écrit est `Canceled`. Quatre billets annulés de la production
        // avaient donc un code QR valide, une commande `Processed`, et se validaient comme des
        // billets ordinaires. Le vocabulaire vit désormais dans `billets-qui-comptent.ts`, où il
        // est relevé sur les données plutôt que supposé.
        const billetsAnnules = await prisma.ticketingOrderItem.findMany({
          where: {
            id: { in: body.participantIds },
            order: { editionId: editionId },
            ...billetAnnule(),
          },
          select: { id: true },
        })

        if (billetsAnnules.length > 0) {
          throw createError({
            status: 400,
            message:
              billetsAnnules.length === body.participantIds.length
                ? "Ce billet a été annulé et ne donne plus droit d'entrée"
                : `${billetsAnnules.length} billet(s) annulé(s) ne donnent plus droit d'entrée`,
          })
        }

        // Valider les billets en utilisant l'ID de OrderItem
        // La portée, sans condition sur l'état : elle sert au `where` de la mise à jour (auquel
        // on ajoute `entryValidated: false`, qui rend le double scan atomique) ET à la relecture
        // qui départage ensuite ce qu'on a validé de ce qu'un autre avait déjà validé.
        const porteeTicket = {
          id: {
            in: body.participantIds,
          },
          order: {
            editionId: editionId,
          },
        }

        const result = await prisma.ticketingOrderItem.updateMany({
          where: { ...porteeTicket, entryValidated: false },
          data: {
            entryValidated: true,
            entryValidatedAt: horodatage,
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

        const constat = await departagerLesEntrees({
          lignes: await prisma.ticketingOrderItem.findMany({
            where: porteeTicket,
            select: {
              id: true,
              entryValidated: true,
              entryValidatedAt: true,
              entryValidatedBy: true,
            },
          }),
          horodatage,
          actorId: user.id,
        })

        await journaliserMouvementDEntree({
          editionId,
          type: 'ticket',
          participantIds: constat.validees,
          mouvement: 'VALIDATED',
          actorId: user.id,
        })

        return createSuccessResponse({
          validated: result.count,
          type: 'ticket',
          alreadyValidated: constat.dejaValidees,
        })
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
