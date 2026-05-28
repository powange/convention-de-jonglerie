import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/tasks/mine
 *
 * Retourne la liste des tâches d'une édition assignées à l'utilisateur courant,
 * incluant le groupe parent et les autres assignés. Accessible à tout utilisateur
 * authentifié — la sélection est filtrée par les assignations de l'utilisateur,
 * donc un non-assigné reçoit une liste vide.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const edition = await prisma.edition.findUnique({
      where: { id: editionId },
      select: { id: true, tasksEnabled: true },
    })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!edition.tasksEnabled) {
      throw createError({ status: 404, message: 'Module tâches désactivé pour cette édition' })
    }

    const tasks = await prisma.task.findMany({
      where: {
        group: { editionId },
        assignments: { some: { userId: user.id } },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        group: { select: { id: true, name: true } },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                prenom: true,
                nom: true,
                email: true,
                emailHash: true,
                profilePicture: true,
              },
            },
          },
        },
      },
    })

    return createSuccessResponse({ tasks })
  },
  { operationName: 'GetMyTasks' }
)
