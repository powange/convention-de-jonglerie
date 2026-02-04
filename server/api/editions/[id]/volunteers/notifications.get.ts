import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canManageEditionVolunteers } from '@@/server/utils/organizer-management'
import { userWithNameSelect } from '@@/server/utils/prisma-select-helpers'
import { validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  // Vérifier les permissions
  const canManage = await canManageEditionVolunteers(editionId, user.id, event)

  // Vérifier si l'utilisateur est team leader
  let isTeamLeader = false

  if (!canManage) {
    const leaderAssignments = await prisma.applicationTeamAssignment.findMany({
      where: {
        isLeader: true,
        application: {
          userId: user.id,
          editionId,
          status: 'ACCEPTED',
        },
      },
    })

    if (leaderAssignments.length === 0) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    isTeamLeader = true
  }

  // Pour les team leaders, ne récupérer que leurs propres notifications
  const notificationsWhere: any = {
    editionId,
  }

  if (isTeamLeader && !canManage) {
    notificationsWhere.senderId = user.id
  }

  // Récupérer la liste des notifications envoyées avec toutes les confirmations
  const notifications = await prisma.volunteerNotificationGroup.findMany({
    where: notificationsWhere,
    include: {
      sender: {
        select: {
          ...userWithNameSelect,
          profilePicture: true,
          updatedAt: true,
        },
      },
      confirmations: {
        include: {
          user: {
            select: {
              ...userWithNameSelect,
              email: true,
              phone: true,
              profilePicture: true,
              updatedAt: true,
            },
          },
        },
        orderBy: {
          confirmedAt: 'desc',
        },
      },
    },
    orderBy: {
      sentAt: 'desc',
    },
  })

  // Pour chaque notification, récupérer les destinataires originaux et organiser les données
  const notificationsWithVolunteers = await Promise.all(
    notifications.map(async (notification) => {
      // Récupérer tous les destinataires originaux pour cette notification
      const whereClause: any = {
        editionId,
        status: 'ACCEPTED',
      }

      // Si on ciblait des équipes spécifiques
      if (
        notification.targetType === 'teams' &&
        notification.selectedTeams &&
        Array.isArray(notification.selectedTeams) &&
        notification.selectedTeams.length > 0
      ) {
        // Utiliser la relation teamAssignments au lieu du champ JSON assignedTeams
        whereClause.teamAssignments = {
          some: {
            team: {
              name: {
                in: notification.selectedTeams as string[],
              },
            },
          },
        }
      }

      const allRecipients = await prisma.editionVolunteerApplication.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              ...userWithNameSelect,
              email: true,
              phone: true,
              profilePicture: true,
              updatedAt: true,
            },
          },
        },
      })

      // Créer un map des confirmations par userId
      const confirmationMap = new Map()
      notification.confirmations.forEach((confirmation) => {
        confirmationMap.set(confirmation.user.id, confirmation)
      })

      // Organiser les bénévoles par statut
      const confirmed = []
      const pending = []

      allRecipients.forEach((recipient) => {
        const confirmation = confirmationMap.get(recipient.user.id)
        const volunteerData = {
          user: {
            id: recipient.user.id,
            pseudo: recipient.user.pseudo,
            prenom: recipient.user.prenom,
            nom: recipient.user.nom,
            email: recipient.user.email,
            phone: recipient.user.phone,
            profilePicture: recipient.user.profilePicture,
            emailHash: recipient.user.emailHash,
            updatedAt: recipient.user.updatedAt,
          },
        }

        if (confirmation && confirmation.confirmedAt) {
          confirmed.push({
            ...volunteerData,
            confirmedAt: confirmation.confirmedAt,
          })
        } else {
          pending.push(volunteerData)
        }
      })

      // Calculer les statistiques
      const actualConfirmationsCount = confirmed.length
      const confirmationRate =
        notification.recipientCount > 0
          ? Math.round((actualConfirmationsCount / notification.recipientCount) * 100 * 100) / 100
          : 0

      return {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        targetType: notification.targetType,
        selectedTeams: notification.selectedTeams,
        recipientCount: notification.recipientCount,
        sentAt: notification.sentAt,
        senderName: notification.sender.pseudo,
        sender: {
          id: notification.sender.id,
          pseudo: notification.sender.pseudo,
          prenom: notification.sender.prenom,
          nom: notification.sender.nom,
          profilePicture: notification.sender.profilePicture,
          emailHash: notification.sender.emailHash,
          updatedAt: notification.sender.updatedAt,
        },
        confirmationsCount: actualConfirmationsCount,
        confirmationRate,
        volunteers: {
          confirmed,
          pending,
        },
        stats: {
          totalRecipients: allRecipients.length,
          confirmationsCount: actualConfirmationsCount,
          confirmationRate,
          pendingCount: pending.length,
        },
      }
    })
  )

  return notificationsWithVolunteers
}, 'GetVolunteerNotifications')
