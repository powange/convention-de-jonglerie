import { wrapApiHandler, createSuccessResponse } from '@@/server/utils/api-helpers'
import { requireAuth, requireResourceOwner } from '@@/server/utils/auth-utils'
import { validateEditionId, validateResourceId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    requireAuth(event)
    const editionId = validateEditionId(event)
    const applicationId = validateResourceId(event, 'applicationId', 'candidature')

    const app = await prisma.editionVolunteerApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, status: true, userId: true, editionId: true },
    })

    if (!app) throw createError({ statusCode: 404, message: 'Candidature introuvable' })
    if (app.editionId !== editionId)
      throw createError({ statusCode: 404, message: 'Candidature introuvable' })
    requireResourceOwner(event, app, { errorMessage: 'Accès refusé' })
    if (app.status !== 'PENDING')
      throw createError({ statusCode: 400, message: 'Impossible de retirer cette candidature' })

    await prisma.editionVolunteerApplication.delete({ where: { id: app.id } })
    return createSuccessResponse(null)
  },
  { operationName: 'WithdrawVolunteerApplicationById' }
)
