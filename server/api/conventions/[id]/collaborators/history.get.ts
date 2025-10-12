import { requireAuth } from '../../../../utils/auth-utils'
import { checkUserConventionPermission } from '../../../../utils/collaborator-management'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const conventionId = parseInt(getRouterParam(event, 'id') || '0')

  const permission = await checkUserConventionPermission(conventionId, user.id)
  if (!permission.hasPermission) throw createError({ statusCode: 403, message: 'Accès refusé' })

  const history = await prisma.collaboratorPermissionHistory.findMany({
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
      avatar: h.actor.profilePicture
        ? { src: h.actor.profilePicture, alt: h.actor.pseudo }
        : h.actor.email
          ? { hash: h.actor.email }
          : null,
    },
    targetUser: h.targetUser && {
      id: h.targetUser.id,
      pseudo: h.targetUser.pseudo,
      avatar: h.targetUser.profilePicture
        ? { src: h.targetUser.profilePicture, alt: h.targetUser.pseudo }
        : h.targetUser.email
          ? { hash: h.targetUser.email }
          : null,
    },
  }))
})
