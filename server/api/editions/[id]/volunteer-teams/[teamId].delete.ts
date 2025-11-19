import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { requireVolunteerManagementAccess } from '@@/server/utils/permissions/volunteer-permissions'
import { validateEditionId, validateResourceId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    // Authentification requise
    await requireAuth(event)

    // Validation des paramètres
    const editionId = validateEditionId(event)
    const teamId = validateResourceId(event, 'teamId', 'équipe')

    // Vérifier les permissions de gestion des bénévoles
    await requireVolunteerManagementAccess(event, editionId)

    // Vérifier que l'équipe existe et appartient à cette édition
    const existingTeam = await prisma.volunteerTeam.findFirst({
      where: {
        id: teamId,
        editionId,
      },
      include: {
        _count: {
          select: {
            timeSlots: true,
          },
        },
      },
    })

    if (!existingTeam) {
      throw createError({
        statusCode: 404,
        message: "Équipe non trouvée ou n'appartient pas à cette édition",
      })
    }

    // Vérifier s'il y a des créneaux assignés à cette équipe
    if (existingTeam._count.timeSlots > 0) {
      throw createError({
        statusCode: 400,
        message: 'Impossible de supprimer une équipe avec des créneaux assignés',
      })
    }

    // Supprimer l'équipe
    await prisma.volunteerTeam.delete({
      where: { id: teamId },
    })

    setResponseStatus(event, 204)
    return null
  },
  { operationName: 'DeleteVolunteerTeam' }
)
