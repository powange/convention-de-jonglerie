import { requireAuth } from '../../../../../utils/auth-utils'
import { prisma } from '../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  const app = await prisma.editionVolunteerApplication.findUnique({
    where: { editionId_userId: { editionId, userId: user.id } },
    select: { id: true, status: true },
  })
  if (!app) throw createError({ statusCode: 404, message: 'Candidature introuvable' })
  if (app.status !== 'PENDING')
    throw createError({ statusCode: 400, message: 'Impossible de retirer cette candidature' })

  await prisma.editionVolunteerApplication.delete({ where: { id: app.id } })
  return { success: true }
})
