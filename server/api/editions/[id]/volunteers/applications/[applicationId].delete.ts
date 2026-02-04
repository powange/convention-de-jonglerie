import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canManageEditionVolunteers } from '@@/server/utils/organizer-management'
import { userWithNameSelect } from '@@/server/utils/prisma-select-helpers'
import { validateEditionId, validateResourceId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const applicationId = validateResourceId(event, 'applicationId', 'candidature')

    // Vérifier les permissions
    const allowed = await canManageEditionVolunteers(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour gérer les bénévoles',
      })
    }

    // Récupérer la candidature pour vérifier qu'elle existe et qu'elle est bien liée à cette édition
    const application = await prisma.editionVolunteerApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        editionId: true,
        source: true,
        user: {
          select: {
            ...userWithNameSelect,
            emailHash: true,
          },
        },
      },
    })

    if (!application) {
      throw createError({
        status: 404,
        message: 'Candidature introuvable',
      })
    }

    // Vérifier que la candidature appartient bien à cette édition
    if (application.editionId !== editionId) {
      throw createError({
        status: 403,
        message: "Cette candidature n'appartient pas à cette édition",
      })
    }

    // Vérifier que la candidature a été ajoutée manuellement
    if (application.source !== 'MANUAL') {
      throw createError({
        status: 403,
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
  },
  { operationName: 'DeleteManualVolunteerApplication' }
)
