import { z } from 'zod'

import { canAccessEditionData } from '../../../../../utils/edition-permissions'
import { prisma } from '../../../../../utils/prisma'

const updateQuotaSchema = z.object({
  title: z.string().min(1, 'Le titre est obligatoire'),
  description: z.string().optional().nullable(),
  quantity: z.number().int().positive('La quantité doit être un nombre positif'),
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const quotaId = parseInt(getRouterParam(event, 'quotaId') || '0')

  if (!editionId || !quotaId) {
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })
  }

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour modifier ces données',
    })

  // Vérifier que le quota existe et appartient à cette édition
  const existingQuota = await prisma.ticketingQuota.findUnique({
    where: { id: quotaId },
  })

  if (!existingQuota) {
    throw createError({ statusCode: 404, message: 'Quota introuvable' })
  }

  if (existingQuota.editionId !== editionId) {
    throw createError({
      statusCode: 403,
      message: "Ce quota n'appartient pas à cette édition",
    })
  }

  const body = await readBody(event)
  const validation = updateQuotaSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      message: validation.error.errors[0].message,
    })
  }

  try {
    const quota = await prisma.ticketingQuota.update({
      where: { id: quotaId },
      data: {
        title: validation.data.title,
        description: validation.data.description || null,
        quantity: validation.data.quantity,
      },
    })

    return quota
  } catch (error: any) {
    console.error('Failed to update quota:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la modification du quota',
    })
  }
})
