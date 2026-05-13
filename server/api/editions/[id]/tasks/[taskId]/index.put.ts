import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { NotificationHelpers, safeNotify } from '#server/utils/notification-service'
import {
  canManageTasks,
  getEditionWithPermissions,
} from '#server/utils/permissions/edition-permissions'
import { assertAssigneesAreAssignable } from '#server/utils/tasks-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const

const bodySchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  deadline: z.string().datetime().nullable().optional(),
  displayOrder: z.number().int().optional(),
  // Si fourni, remplace entièrement la liste d'assignés (set behavior)
  assigneeIds: z.array(z.number().int().positive()).optional(),
  // Si fourni, déplace la tâche dans un autre groupe (de la même édition)
  taskGroupId: z.number().int().positive().optional(),
})

/**
 * PUT /api/editions/[id]/tasks/[taskId]
 *
 * Met à jour une tâche. Les champs absents ne sont pas modifiés.
 * - assigneeIds : si fourni, REMPLACE entièrement les assignations
 *   existantes. Les nouveaux assignés (qui n'étaient pas déjà là) sont
 *   notifiés.
 * - taskGroupId : permet de déplacer la tâche dans un autre groupe (la
 *   cible doit appartenir à la même édition).
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const taskId = Number(getRouterParam(event, 'taskId'))
    if (isNaN(taskId)) {
      throw createError({ status: 400, message: 'Identifiant de tâche invalide' })
    }

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canManageTasks(edition, user)) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    // Vérifier que la tâche appartient à un groupe de cette édition
    const existing = await prisma.task.findFirst({
      where: { id: taskId, group: { editionId } },
      include: {
        assignments: { select: { userId: true } },
      },
    })
    if (!existing) {
      throw createError({ status: 404, message: 'Tâche introuvable' })
    }

    const body = await readBody(event)
    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    // Si déplacement dans un autre groupe, vérifier qu'il existe et appartient à l'édition
    if (data.taskGroupId !== undefined && data.taskGroupId !== existing.taskGroupId) {
      const targetGroup = await prisma.taskGroup.findFirst({
        where: { id: data.taskGroupId, editionId },
        select: { id: true },
      })
      if (!targetGroup) {
        throw createError({
          status: 400,
          message: "Le groupe cible n'appartient pas à cette édition",
        })
      }
    }

    // Vérifier que les nouveaux assignés sont autorisés
    let newlyAssignedIds: number[] = []
    let toRemove: number[] = []
    if (data.assigneeIds !== undefined) {
      const previousIds = new Set(existing.assignments.map((a) => a.userId))
      const targetIds = new Set(data.assigneeIds)
      newlyAssignedIds = [...targetIds].filter((id) => !previousIds.has(id))
      toRemove = [...previousIds].filter((id) => !targetIds.has(id))
      if (newlyAssignedIds.length > 0) {
        await assertAssigneesAreAssignable(editionId, newlyAssignedIds)
      }
    }

    const updateData: Record<string, unknown> = {}
    if (data.title !== undefined) updateData.title = data.title
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null
    }
    if (data.status !== undefined) updateData.status = data.status
    if (data.deadline !== undefined) {
      updateData.deadline = data.deadline ? new Date(data.deadline) : null
    }
    if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder
    if (data.taskGroupId !== undefined) updateData.taskGroupId = data.taskGroupId

    // Mise à jour atomique : assignments + task dans une seule transaction
    const task = await prisma.$transaction(async (tx) => {
      if (toRemove.length > 0) {
        await tx.taskAssignment.deleteMany({
          where: { taskId, userId: { in: toRemove } },
        })
      }
      if (newlyAssignedIds.length > 0) {
        await tx.taskAssignment.createMany({
          data: newlyAssignedIds.map((userId) => ({ taskId, userId })),
          skipDuplicates: true,
        })
      }
      return tx.task.update({
        where: { id: taskId },
        data: updateData,
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
      })
    })

    // Notifier les nouveaux assignés
    const editionName = edition.name || edition.convention.name
    for (const assigneeId of newlyAssignedIds) {
      if (assigneeId === user.id) continue
      await safeNotify(
        () =>
          NotificationHelpers.taskAssigned(assigneeId, task.title, editionName, editionId, task.id),
        'notification tâche assignée'
      )
    }

    return createSuccessResponse({ task })
  },
  { operationName: 'UpdateTask' }
)
