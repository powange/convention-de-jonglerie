import { checkUserConventionPermission } from '../../../utils/collaborator-management'
import { prisma } from '../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const conventionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!event.context.user) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })

  const permission = await checkUserConventionPermission(conventionId, event.context.user.id)
  if (!permission.hasPermission)
    throw createError({ statusCode: 403, statusMessage: 'Accès refusé' })

  const history = await prisma.collaboratorPermissionHistory.findMany({
    where: { conventionId },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      collaborator: { select: { id: true, userId: true, title: true } },
      actor: { select: { id: true, pseudo: true } },
    },
  })

  return history.map((h) => ({
    id: h.id,
    changeType: h.changeType,
    createdAt: h.createdAt,
    actor: h.actor,
    collaborator: h.collaborator,
    before: h.before,
    after: h.after,
  }))
})
