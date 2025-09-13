import { requireAuth } from '../../utils/auth-utils'
import {
  getConventionForDelete,
  shouldArchiveInsteadOfDelete,
  validateConventionId,
} from '../../utils/convention-permissions'
import { prisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  // Vérifier l'authentification
  const user = requireAuth(event)

  try {
    const conventionId = validateConventionId(getRouterParam(event, 'id'))

    // Récupère la convention et vérifie les permissions de suppression
    const convention = await getConventionForDelete(conventionId, user)

    if (shouldArchiveInsteadOfDelete(convention)) {
      // Archiver à la place
      if (!convention.isArchived) {
        const archived = await prisma.convention.update({
          where: { id: conventionId },
          data: { isArchived: true, archivedAt: new Date() },
        })
        await prisma.collaboratorPermissionHistory.create({
          data: {
            conventionId,
            actorId: user.id,
            changeType: 'ARCHIVED',
            targetUserId: null,
            before: { isArchived: false } as any,
            after: { isArchived: true, archivedAt: archived.archivedAt } as any,
          },
        })
      }
      return { message: 'Convention archivée (non supprimée car elle possède des éditions)' }
    } else {
      await prisma.convention.delete({ where: { id: conventionId } })
      return { message: 'Convention supprimée avec succès' }
    }
  } catch (error) {
    if (typeof error === 'object' && error && 'statusCode' in error) throw error as any
    console.error('Erreur lors de la suppression/archivage de la convention:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur serveur lors de la suppression/archivage',
    })
  }
})
