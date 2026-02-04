import { z } from 'zod'

import type { ConventionArchiveSnapshot } from '#server/types/prisma-helpers'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { getConventionForArchive } from '#server/utils/permissions/convention-permissions'
import { validateConventionId } from '#server/utils/validation-helpers'

const schema = z.object({ archived: z.boolean() })

export default wrapApiHandler(
  async (event) => {
    const conventionId = validateConventionId(event)
    const user = requireAuth(event)

    const body = await readBody(event).catch(() => ({}))
    const { archived } = schema.parse(body)

    // Récupère la convention et vérifie les permissions d'archivage
    const convention = await getConventionForArchive(conventionId, user)

    if (convention.isArchived === archived) {
      return { success: true, archived, unchanged: true }
    }

    const before: ConventionArchiveSnapshot = {
      isArchived: convention.isArchived,
      archivedAt: convention.archivedAt,
    }
    const now = new Date()
    const updated = await prisma.convention.update({
      where: { id: conventionId },
      data: { isArchived: archived, archivedAt: archived ? now : null },
    })

    const after: ConventionArchiveSnapshot = {
      isArchived: updated.isArchived,
      archivedAt: updated.archivedAt,
    }

    await prisma.organizerPermissionHistory.create({
      data: {
        conventionId,
        actorId: user.id,
        changeType: archived ? 'ARCHIVED' : 'UNARCHIVED',
        targetUserId: null,
        before,
        after,
      },
    })

    return { success: true, archived: updated.isArchived, archivedAt: updated.archivedAt }
  },
  { operationName: 'ArchiveConvention' }
)
