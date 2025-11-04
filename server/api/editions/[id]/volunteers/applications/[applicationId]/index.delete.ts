import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId, validateResourceId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const applicationId = validateResourceId(event, 'applicationId', 'candidature')

    const app = await prisma.editionVolunteerApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, status: true, userId: true, editionId: true },
    })

    if (!app) throw createError({ statusCode: 404, message: 'Candidature introuvable' })
    if (app.editionId !== editionId)
      throw createError({ statusCode: 404, message: 'Candidature introuvable' })
    if (app.userId !== user.id) throw createError({ statusCode: 403, message: 'Accès refusé' })
    if (app.status !== 'PENDING')
      throw createError({ statusCode: 400, message: 'Impossible de retirer cette candidature' })

    await prisma.editionVolunteerApplication.delete({ where: { id: app.id } })
    return { success: true }
  },
  { operationName: 'WithdrawVolunteerApplicationById' }
)
