import { z } from 'zod'
import { canEditEdition } from '../../../../utils/collaborator-management'
import { prisma } from '../../../../utils/prisma'

const bodySchema = z.object({
  open: z.boolean().optional(),
  description: z.string().max(5000).optional().nullable(),
})

export default defineEventHandler(async (event) => {
  if (!event.context.user)
    throw createError({ statusCode: 401, statusMessage: 'Non authentifié' })
  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, statusMessage: 'Edition invalide' })
  const body = await readBody(event).catch(() => ({}))
  const parsed = bodySchema.parse(body || {})

  // Permission: auteur convention ou collaborateur avec droit édition (reuse canEditEdition)
  const edition = await prisma.edition.findUnique({
    where: { id: editionId },
    select: { conventionId: true },
  })
  if (!edition) throw createError({ statusCode: 404, statusMessage: 'Edition introuvable' })
  const allowed = await canEditEdition(editionId, event.context.user.id)
  if (!allowed)
    throw createError({ statusCode: 403, statusMessage: 'Droits insuffisants' })

  const data: any = {}
  if (parsed.open !== undefined) data.volunteersOpen = parsed.open
  if (parsed.description !== undefined) data.volunteersDescription = parsed.description || null
  if (Object.keys(data).length === 0) return { success: true, unchanged: true }
  data.volunteersUpdatedAt = new Date()

  const updated = await prisma.edition.update({
    where: { id: editionId },
    data,
    select: { volunteersOpen: true, volunteersDescription: true },
  })
  return { success: true, settings: updated }
})
