import { requireAuth } from '@@/server/utils/auth-utils'
import { checkUserConventionPermission } from '@@/server/utils/collaborator-management'
import { prisma } from '@@/server/utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const conventionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!conventionId) {
    throw createError({ statusCode: 400, message: 'ID invalide' })
  }
  const perm = await checkUserConventionPermission(conventionId, user.id)
  if (!perm.hasPermission) {
    throw createError({ statusCode: 403, message: 'Accès refusé' })
  }
  const editions = await prisma.edition.findMany({
    where: { conventionId },
    select: { id: true, name: true, startDate: true, endDate: true },
  })
  return editions
})
