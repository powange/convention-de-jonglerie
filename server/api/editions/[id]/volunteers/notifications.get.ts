import { canManageEditionVolunteers } from '../../../../utils/collaborator-management'
import { getEmailHash } from '../../../../utils/email-hash'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const editionId = parseInt(getRouterParam(event, 'id') || '0')

  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  }

  // Vérifier les permissions
  const canManage = await canManageEditionVolunteers(editionId, event.context.user.id, event)
  if (!canManage) {
    throw createError({ statusCode: 403, statusMessage: 'Droits insuffisants' })
  }

  // Récupérer la liste des notifications envoyées avec toutes les confirmations
  const notifications = await prisma.volunteerNotificationGroup.findMany({
    where: {
      editionId,
    },
    include: {
      sender: {
        select: {
          pseudo: true,
        },
      },
      confirmations: {
        include: {
          user: {
            select: {
              id: true,
              pseudo: true,
              email: true,
              prenom: true,
              nom: true,
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
        // Pour les champs JSON avec arrays, utiliser OR avec array_contains pour chaque équipe
        whereClause.OR = (notification.selectedTeams as string[]).map((team: string) => ({
          assignedTeams: {
            array_contains: team,
          },
        }))
      }

      const allRecipients = await prisma.editionVolunteerApplication.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              pseudo: true,
              email: true,
              prenom: true,
              nom: true,
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
            emailHash: getEmailHash(recipient.user.email),
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
})
