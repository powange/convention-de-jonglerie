import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageTasks,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/task-groups
 *
 * Retourne la liste des groupes de tâches d'une édition, chaque groupe
 * incluant ses tâches (ordonnées) et chaque tâche ses assignations.
 * Accessible aux utilisateurs avec le droit `canManageTasks`.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canManageTasks(edition, user)) {
      throw createError({
        status: 403,
        message: "Vous n'êtes pas autorisé à gérer les tâches de cette édition",
      })
    }

    const groups = await prisma.taskGroup.findMany({
      where: { editionId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        tasks: {
          orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
          include: {
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
        },
      },
    })

    return createSuccessResponse({ groups })
  },
  { operationName: 'GetTaskGroups' }
)
