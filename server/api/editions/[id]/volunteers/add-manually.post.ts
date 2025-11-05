import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canManageEditionVolunteers } from '@@/server/utils/collaborator-management'
import { prisma } from '@@/server/utils/prisma'
import { fetchResourceOrFail } from '@@/server/utils/prisma-helpers'
import { validateEditionId } from '@@/server/utils/validation-helpers'
import { createVolunteerMealSelections } from '@@/server/utils/volunteer-meals'
import { z } from 'zod'

const bodySchema = z.object({
  userId: z.number(),
})

export default wrapApiHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = validateEditionId(event)

  // Vérifier les permissions
  const allowed = await canManageEditionVolunteers(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour gérer les bénévoles',
    })

  const body = bodySchema.parse(await readBody(event))

  // Vérifier que l'utilisateur existe
  const targetUser = await fetchResourceOrFail(prisma.user, body.userId, {
    errorMessage: 'Utilisateur introuvable',
    select: {
      id: true,
      nom: true,
      prenom: true,
      email: true,
      phone: true,
    },
  })

  // Vérifier que l'édition existe
  const edition = await fetchResourceOrFail(prisma.edition, editionId, {
    errorMessage: 'Edition introuvable',
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
      userSnapshotPhone: targetUser.phone || null,
      dietaryPreference: 'NONE',
      setupAvailability: null,
      teardownAvailability: null,
      eventAvailability: null,
      source: 'MANUAL',
      addedById: user.id,
      addedAt: new Date(),
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

  // Créer automatiquement les sélections de repas
  try {
    await createVolunteerMealSelections(application.id, editionId)
  } catch (mealError) {
    console.error('Erreur lors de la création des repas du bénévole:', mealError)
    // Ne pas faire échouer l'ajout si la création des repas échoue
  }

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
}, 'AddVolunteerManually')
