import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { NotificationHelpers, safeNotify } from '#server/utils/notification-service'
import { getEditionWithPermissions } from '#server/utils/permissions/edition-permissions'
import { canCommentTask } from '#server/utils/tasks-helpers'
import { validateEditionId } from '#server/utils/validation-helpers'
import { handleValidationError } from '#server/utils/validation-schemas'

const bodySchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Le contenu est requis')
    .max(5000, 'Le contenu ne peut pas dépasser 5000 caractères'),
})

/**
 * POST /api/editions/[id]/tasks/[taskId]/comments
 *
 * Crée un commentaire sur une tâche. Accessible aux organisateurs avec
 * `canManageTasks` ou aux assignés de la tâche. Notifie les autres
 * assignés (sauf l'auteur du commentaire).
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

    const task = await prisma.task.findFirst({
      where: { id: taskId, group: { editionId } },
      include: { assignments: { select: { userId: true } } },
    })
    if (!task) {
      throw createError({ status: 404, message: 'Tâche introuvable' })
    }

    const assigneeIds = task.assignments.map((a) => a.userId)
    if (!canCommentTask(edition, user, assigneeIds)) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const body = await readBody(event)
    let data: z.infer<typeof bodySchema>
    try {
      data = bodySchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) handleValidationError(error)
      throw error
    }

    const comment = await prisma.taskComment.create({
      data: {
        taskId,
        userId: user.id,
        content: data.content,
      },
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
    })

    // Notifier les autres assignés (sauf l'auteur du commentaire)
    const editionName = edition.name || edition.convention.name
    const authorPseudo = user.pseudo
    for (const assigneeId of assigneeIds) {
      if (assigneeId === user.id) continue
      await safeNotify(
        () =>
          NotificationHelpers.taskCommented(
            assigneeId,
            authorPseudo,
            task.title,
            editionName,
            editionId,
            task.id
          ),
        'notification commentaire tâche'
      )
    }

    return createSuccessResponse({ comment })
  },
  { operationName: 'CreateTaskComment' }
)
