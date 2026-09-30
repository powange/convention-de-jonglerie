import type { ConventionArchiveSnapshot } from '#server/types/prisma-helpers'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { deletePhysicalImageFile } from '#server/utils/image-deletion'
import {
  getConventionForDelete,
  shouldArchiveInsteadOfDelete,
} from '#server/utils/permissions/convention-permissions'
import { validateConventionId } from '#server/utils/validation-helpers'

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
      return createSuccessResponse(
        null,
        'Convention archivée (non supprimée car elle possède des éditions)'
      )
    } else {
      /*
       * Le logo quitte le disque AVANT la suppression, et SEULEMENT dans cette branche.
       *
       * ⚠️ PAS DANS LA BRANCHE QUI ARCHIVE : une convention archivée existe encore, ses éditions
       * aussi, et son logo s'affiche toujours. L'effacer là reviendrait à casser l'affichage d'une
       * convention qu'on vient seulement de retirer de la vue.
       *
       * Avant la suppression, parce qu'après la ligne n'existe plus et que rien ne dirait quel
       * fichier lui appartenait.
       */
      await deletePhysicalImageFile(convention.logo, {
        entityId: conventionId,
        dossier: 'conventions',
      })
      await prisma.convention.delete({ where: { id: conventionId } })
      return createSuccessResponse(null, 'Convention supprimée avec succès')
    }
  },
  { operationName: 'DeleteConvention' }
)
