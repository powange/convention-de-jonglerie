import { prisma } from '../../../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const applicationId = parseInt(getRouterParam(event, 'applicationId') || '0')

  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })
  if (!applicationId) throw createError({ statusCode: 400, message: 'Candidature invalide' })

  const app = await prisma.editionVolunteerApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, status: true, userId: true, editionId: true },
  })

  if (!app) throw createError({ statusCode: 404, message: 'Candidature introuvable' })
  if (app.editionId !== editionId)
    throw createError({ statusCode: 404, message: 'Candidature introuvable' })
  if (app.userId !== event.context.user.id)
    throw createError({ statusCode: 403, message: 'Accès refusé' })
  if (app.status !== 'PENDING')
    throw createError({ statusCode: 400, message: 'Impossible de retirer cette candidature' })

  await prisma.editionVolunteerApplication.delete({ where: { id: app.id } })
  return { success: true }
})
