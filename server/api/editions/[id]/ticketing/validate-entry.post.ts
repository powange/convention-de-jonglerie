import { requireAuth } from '@@/server/utils/auth-utils'
import { NotificationService } from '@@/server/utils/notification-service'
import { canAccessEditionDataOrAccessControl } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const bodySchema = z.object({
  participantIds: z.array(z.number()).min(1),
  type: z.enum(['ticket', 'volunteer']).optional().default('ticket'),
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
      const result = await prisma.editionVolunteerApplication.updateMany({
        where: {
          id: {
            in: body.participantIds,
          },
          editionId: editionId,
          status: 'ACCEPTED',
        },
        data: {
          entryValidated: true,
          entryValidatedAt: new Date(),
          entryValidatedBy: user.id,
        },
      })

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

      return {
        success: true,
        validated: result.count,
        message: `${result.count} bénévole${result.count > 1 ? 's' : ''} validé${result.count > 1 ? 's' : ''}`,
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

      return {
        success: true,
        validated: result.count,
        message: `${result.count} participant${result.count > 1 ? 's' : ''} validé${result.count > 1 ? 's' : ''}`,
      }
    }
  } catch (error: any) {
    console.error('Database validate entry error:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la validation des entrées',
    })
  }
})
