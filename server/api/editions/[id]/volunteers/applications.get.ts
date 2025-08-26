import { canEditEdition } from '../../../../utils/collaborator-management'
import { prisma } from '../../../../utils/prisma'

export default defineEventHandler(async (event) => {
  if (!event.context.user)
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, statusMessage: 'Edition invalide' })

  const allowed = await canEditEdition(editionId, event.context.user.id)
  if (!allowed)
    throw createError({ statusCode: 403, statusMessage: 'Droits insuffisants' })

  const statusFilter = getQuery(event).status as string | undefined
  const where: any = { editionId }
  if (statusFilter) where.status = statusFilter

  const applications = await prisma.editionVolunteerApplication.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      status: true,
      createdAt: true,
      motivation: true,
      userId: true,
      user: { select: { id: true, pseudo: true, email: true, phone: true, prenom: true, nom: true } },
    },
  })
  return { applications }
})
