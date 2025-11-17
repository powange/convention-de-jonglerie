import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessConvention } from '@@/server/utils/organizer-management'
import { prisma } from '@@/server/utils/prisma'
import { validateConventionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conventionId = validateConventionId(event)

    // Vérifier les permissions de lecture (inclut le mode admin)
    const canAccess = await canAccessConvention(conventionId, user.id, event)
    if (!canAccess) throw createError({ statusCode: 403, message: 'Accès refusé' })

    const history = await prisma.organizerPermissionHistory.findMany({
      where: { conventionId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        actor: {
          select: { id: true, pseudo: true, profilePicture: true, email: true, emailHash: true },
        },
        targetUser: {
          select: { id: true, pseudo: true, profilePicture: true, email: true, emailHash: true },
        },
      },
    })

    return history.map((h) => ({
      id: h.id,
      changeType: h.changeType,
      createdAt: h.createdAt,
      actorId: h.actorId,
      targetUserId: h.targetUserId,
      before: h.before,
      after: h.after,
      actor: h.actor && {
        id: h.actor.id,
        pseudo: h.actor.pseudo,
        email: h.actor.email,
        emailHash: h.actor.emailHash,
        profilePicture: h.actor.profilePicture,
      },
      targetUser: h.targetUser && {
        id: h.targetUser.id,
        pseudo: h.targetUser.pseudo,
        email: h.targetUser.email,
        emailHash: h.targetUser.emailHash,
        profilePicture: h.targetUser.profilePicture,
      },
    }))
  },
  { operationName: 'GetOrganizerHistory' }
)
