import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const bodySchema = z.object({
  quotas: z
    .array(
      z.object({
        quotaId: z.number(),
        choiceValue: z.string().optional(),
      })
    )
    .optional(),
  returnableItems: z
    .array(
      z.object({
        returnableItemId: z.number(),
        choiceValue: z.string().optional(),
      })
    )
    .optional(),
})

export default defineEventHandler(async (event) => {
  const user = requireAuth(event)

  const editionId = parseInt(getRouterParam(event, 'id') || '0')
  const customFieldId = parseInt(getRouterParam(event, 'customFieldId') || '0')

  if (!editionId || !customFieldId)
    throw createError({ statusCode: 400, message: 'Paramètres invalides' })

  // Vérifier les permissions
  const allowed = await canAccessEditionData(editionId, user.id, event)
  if (!allowed)
    throw createError({
      statusCode: 403,
      message: 'Droits insuffisants pour accéder à cette fonctionnalité',
    })

  const body = await readBody(event)
  const validation = bodySchema.safeParse(body)

  if (!validation.success) {
    throw createError({
      statusCode: 400,
      message: 'Données invalides',
      data: validation.error.issues,
    })
  }

  const { quotas, returnableItems } = validation.data

  try {
    // Vérifier que le custom field existe et appartient à l'édition
    const customField = await prisma.ticketingTierCustomField.findFirst({
      where: {
        id: customFieldId,
        editionId,
      },
    })

    if (!customField) {
      throw createError({
        statusCode: 404,
        message: 'Custom field introuvable',
      })
    }

    // Note: Les associations peuvent être modifiées même pour les custom fields HelloAsso
    // Seules les propriétés du champ lui-même (label, type, etc.) ne peuvent pas être modifiées

    // Utiliser une transaction pour mettre à jour les associations
    await prisma.$transaction(async (tx) => {
      // 1. Supprimer toutes les associations existantes pour les quotas
      await tx.ticketingTierCustomFieldQuota.deleteMany({
        where: { customFieldId },
      })

      // 2. Supprimer toutes les associations existantes pour les articles à restituer
      await tx.ticketingTierCustomFieldReturnableItem.deleteMany({
        where: { customFieldId },
      })

      // 3. Créer les nouvelles associations de quotas
      if (quotas && quotas.length > 0) {
        for (const quota of quotas) {
          // Vérifier que le quota existe et appartient à l'édition
          const existingQuota = await tx.ticketingQuota.findFirst({
            where: {
              id: quota.quotaId,
              editionId,
            },
          })

          if (!existingQuota) {
            throw createError({
              statusCode: 404,
              message: `Quota ${quota.quotaId} introuvable`,
            })
          }

          await tx.ticketingTierCustomFieldQuota.create({
            data: {
              customFieldId,
              quotaId: quota.quotaId,
              choiceValue: quota.choiceValue || null,
            },
          })
        }
      }

      // 4. Créer les nouvelles associations d'articles à restituer
      if (returnableItems && returnableItems.length > 0) {
        for (const item of returnableItems) {
          // Vérifier que l'article existe et appartient à l'édition
          const existingItem = await tx.ticketingReturnableItem.findFirst({
            where: {
              id: item.returnableItemId,
              editionId,
            },
          })

          if (!existingItem) {
            throw createError({
              statusCode: 404,
              message: `Article ${item.returnableItemId} introuvable`,
            })
          }

          await tx.ticketingTierCustomFieldReturnableItem.create({
            data: {
              customFieldId,
              returnableItemId: item.returnableItemId,
              choiceValue: item.choiceValue || null,
            },
          })
        }
      }
    })

    return {
      success: true,
      message: 'Associations mises à jour avec succès',
    }
  } catch (error: unknown) {
    console.error('Erreur lors de la mise à jour des associations:', error)
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la mise à jour des associations',
    })
  }
})
