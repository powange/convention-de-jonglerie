import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { checkUserConventionPermission } from '@@/server/utils/organizer-management'
import { prisma } from '@@/server/utils/prisma'
import { validateConventionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conventionId = validateConventionId(event)

    const perm = await checkUserConventionPermission(conventionId, user.id)
    if (!perm.hasPermission) {
      throw createError({ statusCode: 403, message: 'Accès refusé' })
    }

    const editions = await prisma.edition.findMany({
      where: { conventionId },
      select: { id: true, name: true, startDate: true, endDate: true },
    })
    return editions
  },
  { operationName: 'GetConventionEditions' }
)
