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
  const optionId = parseInt(getRouterParam(event, 'optionId') || '0')

  if (!editionId || !optionId)
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à cette fonctionnalité',
    })

  const body = bodySchema.parse(await readBody(event))

  try {
    // Vérifier que l'option existe et appartient bien à l'édition
    const existingOption = await prisma.helloAssoOption.findFirst({
      where: {
        id: optionId,
        editionId,
      },
    })

    if (!existingOption) {
      throw createError({
        statusCode: 404,
        message: 'Option non trouvée',
      })
    }

    const isHelloAssoOption = existingOption.helloAssoOptionId !== null

    // Mettre à jour l'option avec ses relations
    const option = await prisma.$transaction(async (tx) => {
      // Supprimer les anciennes relations
      await tx.optionQuota.deleteMany({ where: { optionId } })
      await tx.optionReturnableItem.deleteMany({ where: { optionId } })

      // Pour les options HelloAsso, on met à jour uniquement les relations
      // Pour les options manuelles, on met à jour tout
      if (isHelloAssoOption) {
        return await tx.helloAssoOption.update({
          where: { id: optionId },
          data: {
            quotas: {
              create: body.quotaIds.map((quotaId) => ({ quotaId })),
            },
            returnableItems: {
              create: body.returnableItemIds.map((returnableItemId) => ({ returnableItemId })),
            },
          },
        })
      } else {
        return await tx.helloAssoOption.update({
          where: { id: optionId },
          data: {
            name: body.name,
            description: body.description,
            type: body.type,
            isRequired: body.isRequired,
            choices: body.choices,
            position: body.position,
            quotas: {
              create: body.quotaIds.map((quotaId) => ({ quotaId })),
            },
            returnableItems: {
              create: body.returnableItemIds.map((returnableItemId) => ({ returnableItemId })),
            },
          },
        })
      }
    })

    return {
      success: true,
      option,
    }
  } catch (error: any) {
    console.error('Update option error:', error)
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: "Erreur lors de la mise à jour de l'option",
    })
  }
})
