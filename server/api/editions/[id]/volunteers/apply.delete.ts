import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, statusMessage: 'Edition invalide' })

  const app = await prisma.editionVolunteerApplication.findUnique({
    where: { editionId_userId: { editionId, userId: event.context.user.id } },
    select: { id: true, status: true },
  })
  if (!app) throw createError({ statusCode: 404, statusMessage: 'Candidature introuvable' })
  if (app.status !== 'PENDING')
    throw createError({ statusCode: 400, statusMessage: 'Impossible de retirer cette candidature' })

  await prisma.editionVolunteerApplication.delete({ where: { id: app.id } })
  return { success: true }
})
