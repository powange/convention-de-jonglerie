import { z } from 'zod'

import { requireAuth } from '../../../utils/auth-utils'
import {
  getConventionForArchive,
  validateConventionId,
} from '../../../utils/permissions/convention-permissions'
import { prisma } from '../../../utils/prisma'

const schema = z.object({ archived: z.boolean() })

export default defineEventHandler(async (event) => {
  const conventionId = validateConventionId(getRouterParam(event, 'id'))
  const user = requireAuth(event)

  const body = await readBody(event).catch(() => ({}))
  const { archived } = schema.parse(body)

  // Récupère la convention et vérifie les permissions d'archivage
  const convention = await getConventionForArchive(conventionId, user)

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
      actorId: user.id,
      changeType: archived ? 'ARCHIVED' : 'UNARCHIVED',
      targetUserId: null,
      before: before as any,
      after: { isArchived: updated.isArchived, archivedAt: updated.archivedAt } as any,
    } as any,
  })

  return { success: true, archived: updated.isArchived, archivedAt: updated.archivedAt }
})
