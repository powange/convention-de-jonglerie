import { z } from 'zod'

import { canAccessEditionData } from '../../../../../utils/edition-permissions'
import { prisma } from '../../../../../utils/prisma'

const bodySchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  type: z.string().min(1),
  isRequired: z.boolean().default(false),
  choices: z.array(z.string()).nullable().optional(),
  position: z.number().int().min(0).default(0),
  quotaIds: z.array(z.number().int()).optional().default([]),
  returnableItemIds: z.array(z.number().int()).optional().default([]),
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
      message: 'Droits insuffisants pour accéder à cette fonctionnalité',
    })

  const body = bodySchema.parse(await readBody(event))

  try {
    // Vérifier qu'il existe une configuration de billeterie externe pour cette édition
    const externalTicketing = await prisma.externalTicketing.findUnique({
      where: { editionId },
    })

    if (!externalTicketing) {
      throw createError({
        statusCode: 400,
        message: 'Aucune configuration de billeterie externe trouvée',
      })
    }

    const option = await prisma.helloAssoOption.create({
      data: {
        externalTicketingId: externalTicketing.id,
        editionId,
        name: body.name,
        description: body.description,
        type: body.type,
        isRequired: body.isRequired,
        choices: body.choices,
        position: body.position,
        // helloAssoOptionId reste null pour une option manuelle
        quotas: {
          create: body.quotaIds.map((quotaId) => ({ quotaId })),
        },
        returnableItems: {
          create: body.returnableItemIds.map((returnableItemId) => ({ returnableItemId })),
        },
      },
    })

    return {
      success: true,
      option,
    }
  } catch (error: any) {
    console.error('Create option error:', error)
    throw createError({
      statusCode: 500,
      message: "Erreur lors de la création de l'option",
    })
  }
})
