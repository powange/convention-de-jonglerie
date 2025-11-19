import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessConvention } from '@@/server/utils/organizer-management'
import { validateConventionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const conventionId = validateConventionId(event)

    const canAccess = await canAccessConvention(conventionId, user.id, event)
    if (!canAccess) {
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
