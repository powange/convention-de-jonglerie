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
  title: z
    .string()
    .trim()
    .min(1, 'Le titre est requis')
    .max(200, 'Le titre ne peut pas dépasser 200 caractères'),
  description: z
    .string()
    .trim()
    .max(5000, 'La description ne peut pas dépasser 5000 caractères')
    .nullable()
    .optional(),
  status: z.enum(TASK_STATUSES).optional().default('TODO'),
  deadline: z.string().datetime().nullable().optional(),
  displayOrder: z.number().int().optional(),
  assigneeIds: z.array(z.number().int().positive()).optional().default([]),
})

/**
 * POST /api/editions/[id]/task-groups/[groupId]/tasks
 *
 * Crée une nouvelle tâche dans un groupe. assigneeIds peut être vide.
 * Notifie chaque assigné.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const groupId = Number(getRouterParam(event, 'groupId'))
    if (isNaN(groupId)) {
      throw createError({ status: 400, message: 'Identifiant de groupe invalide' })
    }

    const edition = await getEditionWithPermissions(editionId, { userId: user.id })
    if (!edition) {
      throw createError({ status: 404, message: 'Édition non trouvée' })
    }
    if (!canManageTasks(edition, user)) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const group = await prisma.taskGroup.findFirst({
      where: { id: groupId, editionId },
      select: { id: true, name: true },
    })
    if (!group) {
      throw createError({ status: 404, message: 'Groupe introuvable' })
    }

    const body = await readBody(event)
    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    // Vérifier que les assignés sont autorisés (organisateurs ou bénévoles ACCEPTED)
    if (data.assigneeIds.length > 0) {
      await assertAssigneesAreAssignable(editionId, data.assigneeIds)
    }

    let displayOrder = data.displayOrder
    if (displayOrder === undefined) {
      const last = await prisma.task.findFirst({
        where: { taskGroupId: groupId },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      })
      displayOrder = (last?.displayOrder ?? -1) + 1
    }

    const task = await prisma.task.create({
      data: {
        taskGroupId: groupId,
        title: data.title,
        description: data.description?.trim() || null,
        status: data.status,
        deadline: data.deadline ? new Date(data.deadline) : null,
        displayOrder,
        ...(data.assigneeIds.length > 0 && {
          assignments: {
            create: data.assigneeIds.map((userId) => ({ userId })),
          },
        }),
      },
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

    // Notifier chaque assigné (sauf l'assigneur lui-même)
    const editionName = edition.name || edition.convention.name
    for (const assigneeId of data.assigneeIds) {
      if (assigneeId === user.id) continue
      await safeNotify(
        () =>
          NotificationHelpers.taskAssigned(assigneeId, data.title, editionName, editionId, task.id),
        'notification tâche assignée'
      )
    }

    return createSuccessResponse({ task })
  },
  { operationName: 'CreateTask' }
)
