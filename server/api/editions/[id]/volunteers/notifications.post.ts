import { z } from 'zod'

import { requireAuth } from '../../../../utils/auth-utils'
import { canManageEditionVolunteers } from '../../../../utils/collaborator-management'
import { NotificationService } from '../../../../utils/notification-service'
import { prisma } from '../../../../utils/prisma'

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
  if (!canManage) {
    throw createError({ statusCode: 403, message: 'Droits insuffisants' })
  }

  // Valider les données
  const body = await readBody(event)
  const { targetType, selectedTeams, message } = notificationSchema.parse(body)

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
    // Pour les champs JSON avec arrays, utiliser OR avec array_contains pour chaque équipe
    whereClause.OR = selectedTeams.map((team) => ({
      assignedTeams: {
        array_contains: team,
      },
    }))
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
        title,
        message,
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
