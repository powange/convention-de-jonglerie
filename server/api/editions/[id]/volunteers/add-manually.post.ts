import { z } from 'zod'

import { canManageEditionVolunteers } from '../../../../utils/collaborator-management'
import { prisma } from '../../../../utils/prisma'

const bodySchema = z.object({
  userId: z.number(),
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canManageEditionVolunteers(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour gérer les bénévoles',
    })

  const body = bodySchema.parse(await readBody(event))

  try {
    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: body.userId },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        phone: true,
      },
    })

    if (!user) {
      throw createError({
        statusCode: 404,
        message: 'Utilisateur introuvable',
      })
    }

    // Vérifier que l'édition existe
    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: {
        id: true,
        name: true,
        conventionId: true,
        convention: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!edition) {
      throw createError({
        statusCode: 404,
        message: 'Edition introuvable',
      })
    }

    // Vérifier qu'il n'y a pas déjà une candidature
    const existing = await prisma.editionVolunteerApplication.findUnique({
      where: {
        editionId_userId: {
          editionId,
          userId: body.userId,
        },
      },
    })

    if (existing) {
      throw createError({
        statusCode: 409,
        message: 'Cet utilisateur a déjà une candidature pour cette édition',
      })
    }

    // Créer la candidature avec le statut ACCEPTED
    const application = await prisma.editionVolunteerApplication.create({
      data: {
        editionId,
        userId: body.userId,
        status: 'ACCEPTED',
        motivation: 'Ajouté manuellement par un organisateur',
        userSnapshotPhone: user.phone || null,
        dietaryPreference: 'NONE',
        setupAvailability: null,
        teardownAvailability: null,
        eventAvailability: null,
      },
      select: {
        id: true,
        status: true,
        user: {
          select: {
            id: true,
            pseudo: true,
            prenom: true,
            nom: true,
            email: true,
          },
        },
      },
    })

    // Envoyer une notification à l'utilisateur ajouté
    try {
      await prisma.notification.create({
        data: {
          userId: body.userId,
          type: 'SUCCESS',
          title: 'Vous avez été ajouté comme bénévole ! 🎉',
          message: `Vous avez été ajouté comme bénévole pour "${edition.convention.name}${edition.name ? ' - ' + edition.name : ''}". Votre candidature a été automatiquement acceptée.`,
          category: 'volunteer',
          entityType: 'Edition',
          entityId: editionId.toString(),
          actionUrl: `/editions/${editionId}/volunteers`,
          actionText: 'Voir les détails',
        },
      })
    } catch (notificationError) {
      console.error("Erreur lors de l'envoi de la notification:", notificationError)
    }

    return {
      success: true,
      application,
    }
  } catch (error: any) {
    console.error("Erreur lors de l'ajout manuel du bénévole:", error)
    throw error
  }
})
