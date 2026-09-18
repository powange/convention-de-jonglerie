import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import {
  canManageTasks,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * GET /api/editions/[id]/task-groups/[groupId]
 *
 * UN groupe, avec ses tâches et tout ce qu'elles portent : assignations, checklist, étiquettes.
 *
 * ⚠️ Ce point existe parce que l'écran d'un groupe n'en affiche qu'un seul. Il lisait jusqu'ici la
 * liste complète — tous les groupes de l'édition, toutes leurs tâches, tous leurs assignés — pour
 * en retenir un et jeter le reste, et il la relisait après chaque action : cocher une case de
 * checklist rechargeait l'intégralité du tableau de l'édition.
 *
 * La liste, elle, ne rend plus que des résumés : voir `../index.get.ts`.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const groupId = Number(getRouterParam(event, 'groupId'))
    if (!Number.isInteger(groupId) || groupId <= 0) {
      throw createError({ status: 400, message: 'Identifiant de groupe invalide' })
    }

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

    // `editionId` dans la clause, et pas seulement l'identifiant du groupe : sans lui, connaître un
    // numéro suffirait à lire les tâches d'une autre convention.
    const group = await prisma.taskGroup.findFirst({
      where: { id: groupId, editionId },
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
                    emailHash: true,
                    profilePicture: true,
                  },
                },
              },
            },
            checklistItems: {
              orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
              select: { id: true, title: true, done: true, displayOrder: true },
            },
            tagAssignments: {
              include: {
                tag: { select: { id: true, name: true, color: true } },
              },
            },
          },
        },
      },
    })

    if (!group) {
      throw createError({ status: 404, message: 'Groupe introuvable' })
    }

    return createSuccessResponse({ group })
  },
  { operationName: 'GetTaskGroup' }
)
