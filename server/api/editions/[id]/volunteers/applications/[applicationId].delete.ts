import { requireAuth } from '@@/server/utils/auth-utils'
import { canManageEditionVolunteers } from '@@/server/utils/collaborator-management'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const applicationId = parseInt(getRouterParam(event, 'applicationId') || '0')

  if (!editionId || !applicationId) {
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })
  }

  // Vérifier les permissions
  const allowed = await canManageEditionVolunteers(editionId, user.id, event)
  if (!allowed) {
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour gérer les bénévoles',
    })
  }

  try {
    // Récupérer la candidature pour vérifier qu'elle existe et qu'elle est bien liée à cette édition
    const application = await prisma.editionVolunteerApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        editionId: true,
        source: true,
        user: {
          select: {
            id: true,
            prenom: true,
            nom: true,
            email: true,
          },
        },
      },
    })

    if (!application) {
      throw createError({
        statusCode: 404,
        message: 'Candidature introuvable',
      })
    }

    // Vérifier que la candidature appartient bien à cette édition
    if (application.editionId !== editionId) {
      throw createError({
        statusCode: 403,
        message: "Cette candidature n'appartient pas à cette édition",
      })
    }

    // Vérifier que la candidature a été ajoutée manuellement
    if (application.source !== 'MANUAL') {
      throw createError({
        statusCode: 403,
        message: 'Seules les candidatures ajoutées manuellement peuvent être supprimées',
      })
    }

    // Supprimer la candidature
    await prisma.editionVolunteerApplication.delete({
      where: { id: applicationId },
    })

    return {
      success: true,
      message: 'Candidature supprimée avec succès',
    }
  } catch (error: unknown) {
    console.error('Erreur lors de la suppression de la candidature:', error)
    throw error
  }
})
