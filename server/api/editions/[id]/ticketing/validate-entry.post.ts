import { requireAuth } from '@@/server/utils/auth-utils'
import { updateUserInfo } from '@@/server/utils/editions/ticketing/user-info-update'
import { NotificationService } from '@@/server/utils/notification-service'
import { canAccessEditionDataOrAccessControl } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const bodySchema = z.object({
  participantIds: z.array(z.number()).min(1),
  type: z.enum(['ticket', 'volunteer', 'artist']).optional().default('ticket'),
  markAsPaid: z.boolean().optional().default(false),
  userInfo: z
    .object({
      firstName: z.string().nullable().optional(),
      lastName: z.string().nullable().optional(),
      email: z.string().email().nullable().optional(),
      phone: z.string().nullable().optional(),
    })
    .optional(),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions (gestionnaires OU bénévoles en créneau actif de contrôle d'accès)
  const allowed = await canAccessEditionDataOrAccessControl(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
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

      const result = await prisma.editionVolunteerApplication.updateMany({
        where: {
          id: {
            in: body.participantIds,
          },
          editionId: editionId,
          status: 'ACCEPTED',
        },
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
            editionId: editionId,
          },
          select: {
            userId: true,
          },
        })

        const userIds = applications.map((app) => app.userId)

        // Mettre à jour les informations utilisateur
        await updateUserInfo(userIds, body.userInfo)
      }

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
            // Trouver les leaders de cette équipe
            const teamLeaders = await prisma.applicationTeamAssignment.findMany({
              where: {
                teamId: teamAssignment.teamId,
                isLeader: true,
              },
              include: {
                application: {
                  select: {
                    userId: true,
                  },
                },
              },
            })

            // Envoyer une notification à chaque leader
            for (const leader of teamLeaders) {
              const volunteerName =
                `${application.user.prenom || ''} ${application.user.nom || ''}`.trim() ||
                application.user.pseudo

              await NotificationService.create({
                userId: leader.application.userId,
                type: 'INFO',
                title: "Arrivée d'un bénévole 🎉",
                message: `${volunteerName} (@${application.user.pseudo}) vient de scanner son billet et est arrivé sur la convention - Équipe ${teamAssignment.team.name}`,
                category: 'volunteer',
                entityType: 'EditionVolunteerApplication',
                entityId: application.id.toString(),
                actionUrl: `/editions/${editionId}/gestion/volunteers/planning`,
                actionText: 'Voir le planning',
                notificationType: 'volunteer_arrival',
              })
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
        const { broadcastToEditionSSE } = await import('@@/server/utils/sse-manager')
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

      return {
        success: true,
        validated: result.count,
        message: `${result.count} bénévole${result.count > 1 ? 's' : ''} validé${result.count > 1 ? 's' : ''}`,
      }
    } else if (body.type === 'artist') {
      // Valider les artistes
      const result = await prisma.editionArtist.updateMany({
        where: {
          id: {
            in: body.participantIds,
          },
          editionId: editionId,
        },
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
              shows: {
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

          // Récupérer tous les collaborateurs avec droits de gestion des artistes
          const artistManagers = await prisma.editionCollaborator.findMany({
            where: {
              editionId: editionId,
              canManageArtists: true,
            },
            select: {
              userId: true,
            },
          })

          // Construire le nom de l'artiste
          const artistName =
            `${artist.user.prenom || ''} ${artist.user.nom || ''}`.trim() || artist.user.pseudo

          // Construire la liste des spectacles
          const shows = artist.shows.map((showArtist) => showArtist.show.title)

          // Envoyer une notification à chaque responsable artiste
          const { NotificationHelpers } = await import('@@/server/utils/notification-service')
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
        const { broadcastToEditionSSE } = await import('@@/server/utils/sse-manager')
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

      return {
        success: true,
        validated: result.count,
        message: `${result.count} artiste${result.count > 1 ? 's' : ''} validé${result.count > 1 ? 's' : ''}`,
      }
    } else {
      // Valider les billets en utilisant l'ID de OrderItem
      const result = await prisma.ticketingOrderItem.updateMany({
        where: {
          id: {
            in: body.participantIds,
          },
          order: {
            editionId: editionId,
          },
        },
        data: {
          entryValidated: true,
          entryValidatedAt: new Date(),
          entryValidatedBy: user.id,
        },
      })

      // Si le paiement est confirmé, mettre à jour le statut de la commande et des items
      if (body.markAsPaid) {
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

        // Mettre à jour le statut des commandes de "Pending" à "Onsite"
        await prisma.ticketingOrder.updateMany({
          where: {
            id: {
              in: orderIds,
            },
            status: 'Pending',
          },
          data: {
            status: 'Onsite',
          },
        })

        // Mettre à jour le statut des items de "Pending" à "Processed"
        await prisma.ticketingOrderItem.updateMany({
          where: {
            id: {
              in: body.participantIds,
            },
            state: 'Pending',
          },
          data: {
            state: 'Processed',
          },
        })
      }

      // Notifier via SSE
      try {
        const { broadcastToEditionSSE } = await import('@@/server/utils/sse-manager')
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

      return {
        success: true,
        validated: result.count,
        message: `${result.count} participant${result.count > 1 ? 's' : ''} validé${result.count > 1 ? 's' : ''}`,
      }
    }
  } catch (error: unknown) {
    console.error('Database validate entry error:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la validation des entrées',
    })
  }
})
