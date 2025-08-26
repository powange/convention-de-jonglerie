import { z } from 'zod'
import { canEditEdition } from '../../../../../utils/collaborator-management'
import { prisma } from '../../../../../utils/prisma'

const bodySchema = z.object({ status: z.enum(['ACCEPTED', 'REJECTED']) })

export default defineEventHandler(async (event) => {
  if (!event.context.user)
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const applicationId = parseInt(getRouterParam(event, 'applicationId') || '0')
  if (!editionId || !applicationId)
    throw createError({ statusCode: 400, statusMessage: 'Paramètres invalides' })
  const parsed = bodySchema.parse(await readBody(event))

  const allowed = await canEditEdition(editionId, event.context.user.id)
  if (!allowed)
    throw createError({ statusCode: 403, statusMessage: 'Droits insuffisants' })

  const application = await prisma.editionVolunteerApplication.findUnique({
    where: { id: applicationId },
    select: { id: true, editionId: true, status: true },
  })
  if (!application || application.editionId !== editionId)
    throw createError({ statusCode: 404, statusMessage: 'Candidature introuvable' })
  if (application.status !== 'PENDING')
    throw createError({ statusCode: 400, statusMessage: 'Déjà traitée' })

  const updated = await prisma.editionVolunteerApplication.update({
    where: { id: applicationId },
    data: { status: parsed.status, decidedAt: new Date() },
    select: { id: true, status: true, decidedAt: true },
  })
  return { success: true, application: updated }
})
