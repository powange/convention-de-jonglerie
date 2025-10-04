import { z } from 'zod'

import { canAccessEditionData } from '../../../../../utils/edition-permissions'
import { prisma } from '../../../../../utils/prisma'

const bodySchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  price: z.number().int().min(0),
  minAmount: z.number().int().min(0).nullable().optional(),
  maxAmount: z.number().int().min(0).nullable().optional(),
  position: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  quotaIds: z.array(z.number().int()).optional().default([]),
  returnableItemIds: z.array(z.number().int()).optional().default([]),
})

export default defineEventHandler(async (event) => {
  if (!event.context.user) throw createError({ statusCode: 401, message: 'Non authentifié' })

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const tierId = parseInt(getRouterParam(event, 'tierId') || '0')

  if (!editionId) throw createError({ statusCode: 400, message: 'Edition invalide' })
  if (!tierId) throw createError({ statusCode: 400, message: 'Tarif invalide' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, event.context.user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à cette fonctionnalité',
    })

  const body = bodySchema.parse(await readBody(event))

  try {
    // Vérifier que le tarif existe et appartient à cette édition
    const existingTier = await prisma.helloAssoTier.findFirst({
      where: {
        id: tierId,
        editionId,
      },
    })

    if (!existingTier) {
      throw createError({
        statusCode: 404,
        message: 'Tarif introuvable',
      })
    }

    const isHelloAssoTier = existingTier.helloAssoTierId !== null

    // Mettre à jour le tarif avec ses relations
    const tier = await prisma.$transaction(async (tx) => {
      // Supprimer les anciennes relations
      await tx.tierQuota.deleteMany({ where: { tierId } })
      await tx.tierReturnableItem.deleteMany({ where: { tierId } })

      // Pour les tarifs HelloAsso, on met à jour uniquement les relations
      // Pour les tarifs manuels, on met à jour tout
      if (isHelloAssoTier) {
        return await tx.helloAssoTier.update({
          where: { id: tierId },
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
        return await tx.helloAssoTier.update({
          where: { id: tierId },
          data: {
            name: body.name,
            description: body.description,
            price: body.price,
            minAmount: body.minAmount,
            maxAmount: body.maxAmount,
            position: body.position,
            isActive: body.isActive,
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
      tier,
    }
  } catch (error: any) {
    console.error('Update tier error:', error)
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la modification du tarif',
    })
  }
})
