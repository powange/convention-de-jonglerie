import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import {
  getConventionForDelete,
  shouldArchiveInsteadOfDelete,
} from '@@/server/utils/permissions/convention-permissions'
import { validateConventionId } from '@@/server/utils/validation-helpers'

import type { ConventionArchiveSnapshot } from '@@/server/types/prisma-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conventionId = validateConventionId(event)

    // Récupère la convention et vérifie les permissions de suppression
    const convention = await getConventionForDelete(conventionId, user)

    if (shouldArchiveInsteadOfDelete(convention)) {
      // Archiver à la place
      if (!convention.isArchived) {
        const archived = await prisma.convention.update({
          where: { id: conventionId },
          data: { isArchived: true, archivedAt: new Date() },
        })
        const before: ConventionArchiveSnapshot = { isArchived: false }
        const after: ConventionArchiveSnapshot = {
          isArchived: true,
          archivedAt: archived.archivedAt,
        }
        await prisma.organizerPermissionHistory.create({
          data: {
            conventionId,
            actorId: user.id,
            changeType: 'ARCHIVED',
            targetUserId: null,
            before,
            after,
          },
        })
      }
      return { message: 'Convention archivée (non supprimée car elle possède des éditions)' }
    } else {
      await prisma.convention.delete({ where: { id: conventionId } })
      return { message: 'Convention supprimée avec succès' }
    }
  },
  { operationName: 'DeleteConvention' }
)
