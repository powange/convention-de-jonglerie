import { wrapApiHandler } from '@@/server/utils/api-helpers'
import { requireAuth } from '@@/server/utils/auth-utils'
import { prisma } from '@@/server/utils/prisma'
import { validateEditionId } from '@@/server/utils/validation-helpers'

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const app = await prisma.editionVolunteerApplication.findUnique({
      where: { editionId_userId: { editionId, userId: user.id } },
      select: { id: true, status: true },
    })
    if (!app) throw createError({ statusCode: 404, message: 'Candidature introuvable' })
    if (app.status !== 'PENDING')
      throw createError({ statusCode: 400, message: 'Impossible de retirer cette candidature' })

    await prisma.editionVolunteerApplication.delete({ where: { id: app.id } })
    return { success: true }
  },
  { operationName: 'WithdrawOwnVolunteerApplication' }
)
