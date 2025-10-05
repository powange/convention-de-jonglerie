import { z } from 'zod'

import { canAccessEditionData } from '../../../../../utils/permissions/edition-permissions'
import { prisma } from '../../../../../utils/prisma'

const createQuotaSchema = z.object({
  title: z.string().min(1, 'Le titre est obligatoire'),
  description: z.string().optional().nullable(),
  quantity: z.number().int().positive('La quantité doit être un nombre positif'),
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour modifier ces données',
    })

  const body = await readBody(event)
  const validation = createQuotaSchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      message: validation.error.errors[0].message,
    })
  }

  try {
    const quota = await prisma.ticketingQuota.create({
      data: {
        editionId,
        title: validation.data.title,
        description: validation.data.description || null,
        quantity: validation.data.quantity,
      },
    })

    return quota
  } catch (error: any) {
    console.error('Failed to create quota:', error)
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la création du quota',
    })
  }
})
