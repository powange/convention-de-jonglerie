import { canManageEditionVolunteers } from '../../../../../../utils/collaborator-management'
import { getEmailHash } from '../../../../../../utils/email-hash'
import { prisma } from '../../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const groupId = getRouterParam(event, 'groupId')

  if (!event.context.user) {
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  }

  // Vérifier les permissions
  const canManage = await canManageEditionVolunteers(editionId, event.context.user.id, event)
  if (!canManage) {
    throw createError({ statusCode: 403, statusMessage: 'Droits insuffisants' })
  }

  if (!groupId) {
    throw createError({ statusCode: 400, statusMessage: 'ID de groupe requis' })
  }

  // Récupérer le groupe de notifications avec les confirmations
  const notificationGroup = await prisma.volunteerNotificationGroup.findFirst({
    where: {
      id: groupId,
      editionId,
    },
    include: {
      edition: {
        select: {
          name: true,
          convention: {
            select: { name: true },
          },
        },
      },
      sender: {
        select: { pseudo: true },
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
  })

  if (!notificationGroup) {
    throw createError({ statusCode: 404, statusMessage: 'Notification introuvable' })
  }

  // Récupérer tous les destinataires originaux (pour identifier ceux qui n'ont pas confirmé)
  const whereClause: any = {
    editionId,
    status: 'ACCEPTED',
  }

  // Si on ciblait des équipes spécifiques
  if (
    notificationGroup.targetType === 'teams' &&
    notificationGroup.selectedTeams &&
    Array.isArray(notificationGroup.selectedTeams) &&
    notificationGroup.selectedTeams.length > 0
  ) {
    // Pour les champs JSON avec arrays, utiliser OR avec array_contains pour chaque équipe
    whereClause.OR = (notificationGroup.selectedTeams as string[]).map((team: string) => ({
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

  // Créer un set des IDs qui ont vraiment confirmé (confirmedAt non null)
  const confirmedUserIds = new Set(
    notificationGroup.confirmations.filter((c) => c.confirmedAt !== null).map((c) => c.user.id)
  )

  // Séparer les bénévoles confirmés et non confirmés
  const confirmedVolunteers = allRecipients.filter((volunteer) =>
    confirmedUserIds.has(volunteer.user.id)
  )
  const pendingVolunteers = allRecipients.filter(
    (volunteer) => !confirmedUserIds.has(volunteer.user.id)
  )

  // Calculer les statistiques
  const actualConfirmationsCount = notificationGroup.confirmations.filter(
    (c) => c.confirmedAt !== null
  ).length
  const confirmationRate =
    notificationGroup.recipientCount > 0
      ? (actualConfirmationsCount / notificationGroup.recipientCount) * 100
      : 0

  return {
    notification: {
      id: notificationGroup.id,
      title: notificationGroup.title,
      message: notificationGroup.message,
      targetType: notificationGroup.targetType,
      selectedTeams: notificationGroup.selectedTeams,
      recipientCount: notificationGroup.recipientCount,
      sentAt: notificationGroup.sentAt,
      senderName: notificationGroup.sender.pseudo,
      editionName: notificationGroup.edition.name,
      conventionName: notificationGroup.edition.convention.name,
    },
    confirmed: confirmedVolunteers.map((volunteer) => {
      const confirmation = notificationGroup.confirmations.find(
        (c) => c.user.id === volunteer.user.id
      )
      return {
        user: {
          id: volunteer.user.id,
          pseudo: volunteer.user.pseudo,
          prenom: volunteer.user.prenom,
          nom: volunteer.user.nom,
          email: volunteer.user.email,
          phone: volunteer.user.phone,
          profilePicture: volunteer.user.profilePicture,
          emailHash: getEmailHash(volunteer.user.email),
          updatedAt: volunteer.user.updatedAt,
        },
        confirmedAt: confirmation?.confirmedAt,
      }
    }),
    pending: pendingVolunteers.map((volunteer) => ({
      user: {
        id: volunteer.user.id,
        pseudo: volunteer.user.pseudo,
        prenom: volunteer.user.prenom,
        nom: volunteer.user.nom,
        email: volunteer.user.email,
        phone: volunteer.user.phone,
        profilePicture: volunteer.user.profilePicture,
        emailHash: getEmailHash(volunteer.user.email),
        updatedAt: volunteer.user.updatedAt,
      },
    })),
    stats: {
      totalRecipients: allRecipients.length,
      confirmationsCount: actualConfirmationsCount,
      confirmationRate: Math.round(confirmationRate * 100) / 100, // 2 décimales
      pendingCount: pendingVolunteers.length,
    },
  }
})
