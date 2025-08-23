import { z } from 'zod'

import { prisma } from '../../../utils/prisma'

const schema = z.object({ archived: z.boolean() })

export default defineEventHandler(async (event) => {
  const conventionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!event.context.user) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const body = await readBody(event).catch(() => ({}))
  const { archived } = schema.parse(body)

  // Permission: utiliser canManageCollaborators ou futur droit spécifique (ici deleteConvention = archive si éditions)
  const convention = await prisma.convention.findUnique({
    where: { id: conventionId },
    include: { editions: { select: { id: true } } },
  })
  if (!convention) throw createError({ statusCode: 404, statusMessage: 'Convention introuvable' })

  const manager = await prisma.conventionCollaborator.findUnique({
    where: { conventionId_userId: { conventionId, userId: event.context.user.id } },
    select: { canDeleteConvention: true },
  })
  const isAuthor = convention.authorId === event.context.user.id
  const allowed = isAuthor || manager?.canDeleteConvention
  if (!allowed) throw createError({ statusCode: 403, statusMessage: 'Droit insuffisant' })

  if (convention.isArchived === archived) {
    return { success: true, archived, unchanged: true }
  }

  const before = { isArchived: convention.isArchived, archivedAt: convention.archivedAt }
  const now = new Date()
  const updated = await prisma.convention.update({
    where: { id: conventionId },
    data: { isArchived: archived, archivedAt: archived ? now : null },
  })

  await prisma.collaboratorPermissionHistory.create({
    data: {
      conventionId,
      actorId: event.context.user.id,
      changeType: archived ? 'ARCHIVED' : 'UNARCHIVED',
      before: before as any,
      after: { isArchived: updated.isArchived, archivedAt: updated.archivedAt } as any,
    },
  })

  return { success: true, archived: updated.isArchived, archivedAt: updated.archivedAt }
})
