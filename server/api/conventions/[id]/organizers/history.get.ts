import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { getEmailHash } from '@@/server/utils/email-hash'
import { checkUserConventionPermission } from '@@/server/utils/organizer-management'
import { prisma } from '@@/server/utils/prisma'
import { validateConventionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conventionId = validateConventionId(event)

    const permission = await checkUserConventionPermission(conventionId, user.id)
    if (!permission.hasPermission) throw createError({ statusCode: 403, message: 'Accès refusé' })

    const history = await prisma.organizerPermissionHistory.findMany({
      where: { conventionId },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        actor: { select: { id: true, pseudo: true, profilePicture: true, email: true } },
        targetUser: { select: { id: true, pseudo: true, profilePicture: true, email: true } },
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
        emailHash: getEmailHash(h.actor.email),
        profilePicture: h.actor.profilePicture,
      },
      targetUser: h.targetUser && {
        id: h.targetUser.id,
        pseudo: h.targetUser.pseudo,
        email: h.targetUser.email,
        emailHash: getEmailHash(h.targetUser.email),
        profilePicture: h.targetUser.profilePicture,
      },
    }))
  },
  { operationName: 'GetOrganizerHistory' }
)
