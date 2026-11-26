import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Récupère toutes les candidatures de l'utilisateur connecté pour une édition
 * Endpoint optimisé pour éviter les requêtes N+1
 * Accessible par tout utilisateur authentifié
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Récupérer toutes les candidatures de l'utilisateur pour cette édition
    const applications = await prisma.showApplication.findMany({
      where: {
        userId: user.id,
        showCall: {
          editionId,
        },
      },
      include: {
        showCall: {
          select: {
            id: true,
            name: true,
            visibility: true,
            deadline: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Transformer pour ajouter showCallName au niveau de l'application
    const applicationsWithShowCallName = applications.map((app) => ({
      id: app.id,
      showCallId: app.showCallId,
      showCallName: app.showCall.name,
      showCallVisibility: app.showCall.visibility,
      showCallDeadline: app.showCall.deadline,
      userId: app.userId,
      status: app.status,
      artistName: app.artistName,
      showTitle: app.showTitle,
      showDescription: app.showDescription,
      showDuration: app.showDuration,
      additionalPerformersCount: app.additionalPerformersCount,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
    }))

    return {
      applications: applicationsWithShowCallName,
    }
  },
  { operationName: 'GetMyShowCallApplications' }
)
