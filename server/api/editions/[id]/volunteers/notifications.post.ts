import { requireAuth } from '@@/server/utils/auth-utils'
import { canManageEditionVolunteers } from '@@/server/utils/collaborator-management'
import { NotificationService } from '@@/server/utils/notification-service'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const notificationSchema = z.object({
  targetType: z.enum(['all', 'teams']),
  selectedTeams: z.array(z.string()).optional(),
  message: z
    .string()
    .min(1, 'Le message est requis')
    .max(500, 'Le message ne peut pas dépasser 500 caractères'),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = parseInt(getRouterParam(event, 'id') || '0')

  // Vérifier les permissions
  const canManage = await canManageEditionVolunteers(editionId, user.id, event)

  // Si l'utilisateur ne peut pas gérer, vérifier s'il est team leader
  let isTeamLeader = false
  let leaderTeamNames: string[] = []

  if (!canManage) {
    // Vérifier si l'utilisateur est team leader
    const leaderAssignments = await prisma.applicationTeamAssignment.findMany({
      where: {
        isLeader: true,
        application: {
          userId: user.id,
          editionId,
          status: 'ACCEPTED',
        },
      },
      select: {
        team: {
          select: {
            name: true,
          },
        },
      },
    })

    if (leaderAssignments.length === 0) {
      throw createError({ statusCode: 403, message: 'Droits insuffisants' })
    }

    isTeamLeader = true
    leaderTeamNames = leaderAssignments.map((a) => a.team.name)
  }

  // Valider les données
  const body = await readBody(event)
  const { targetType, selectedTeams, message } = notificationSchema.parse(body)

  // Si team leader, forcer le targetType à 'teams' et valider les équipes
  if (isTeamLeader) {
    if (targetType !== 'teams' || !selectedTeams || selectedTeams.length === 0) {
      throw createError({
        statusCode: 400,
        message: "Les responsables d'équipe doivent cibler des équipes spécifiques",
      })
    }

    // Vérifier que toutes les équipes sélectionnées sont bien celles dont l'utilisateur est responsable
    const invalidTeams = selectedTeams.filter((team) => !leaderTeamNames.includes(team))
    if (invalidTeams.length > 0) {
      throw createError({
        statusCode: 403,
        message: `Vous n'êtes pas responsable de ces équipes : ${invalidTeams.join(', ')}`,
      })
    }
  }

  // Récupérer l'édition avec les informations de la convention
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: {
      name: true,
      convention: {
        select: { name: true },
      },
    },
  })

  if (!edition) {
    throw createError({ statusCode: 404, message: 'Édition introuvable' })
  }

  // Construire la requête pour récupérer les bénévoles
  const whereClause: any = {
    editionId,
    status: 'ACCEPTED',
  }

  // Si on cible des équipes spécifiques
  if (targetType === 'teams' && selectedTeams && selectedTeams.length > 0) {
    // Utiliser la relation teamAssignments au lieu du champ JSON assignedTeams
    whereClause.teamAssignments = {
      some: {
        team: {
          name: {
            in: selectedTeams,
          },
        },
      },
    }
  }

  // Récupérer les bénévoles acceptés
  const volunteers = await prisma.editionVolunteerApplication.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          pseudo: true,
          email: true,
        },
      },
    },
  })

  if (volunteers.length === 0) {
    throw createError({ statusCode: 400, message: 'Aucun bénévole trouvé avec ces critères' })
  }

  // Utiliser le nom de l'édition si disponible, sinon le nom de la convention
  const displayName = edition.name || edition.convention.name
  const title = `Bénévoles - ${displayName}`

  // Enregistrer les métadonnées du groupe de notifications pour le suivi
  const notificationGroup = await prisma.volunteerNotificationGroup.create({
    data: {
      editionId,
      senderId: user.id,
      title,
      message,
      targetType,
      selectedTeams: targetType === 'teams' ? selectedTeams : null,
      recipientCount: volunteers.length,
      sentAt: new Date(),
    },
  })

  // URL de confirmation de lecture avec l'ID généré automatiquement
  const confirmationUrl = `/editions/${editionId}/volunteers/notification/${notificationGroup.id}/confirm`

  // Créer les enregistrements de confirmation pour chaque bénévole (avec confirmedAt = null)
  await prisma.volunteerNotificationConfirmation.createMany({
    data: volunteers.map((volunteer) => ({
      volunteerNotificationGroupId: notificationGroup.id,
      userId: volunteer.user.id,
      confirmedAt: null,
    })),
  })

  // Créer les notifications pour chaque bénévole
  const _notifications = await Promise.all(
    volunteers.map(async (volunteer) => {
      return await NotificationService.create({
        userId: volunteer.user.id,
        type: 'INFO',
        titleText: title,
        messageText: message,
        category: 'volunteer',
        entityType: 'Edition',
        entityId: editionId.toString(),
        actionUrl: confirmationUrl,
        actionText: 'Confirmer la lecture',
      })
    })
  )

  return {
    success: true,
    recipientCount: volunteers.length,
    notificationGroupId: notificationGroup.id,
    confirmationUrl,
  }
})
