import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'

const bodySchema = z.object({
  tierIds: z.array(z.number()).optional(),
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

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const customFieldId = validateResourceId(event, 'customFieldId', 'custom field')

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    const body = bodySchema.parse(await readBody(event))
    const { tierIds, quotas, returnableItems } = body

    // Vérifier que le custom field existe et appartient à l'édition
    const customField = await prisma.ticketingTierCustomField.findFirst({
      where: {
        id: customFieldId,
        editionId,
      },
    })

    if (!customField) {
      throw createError({
        status: 404,
        message: 'Custom field introuvable',
      })
    }

    // Note: Les associations peuvent être modifiées même pour les custom fields HelloAsso
    // Seules les propriétés du champ lui-même (label, type, etc.) ne peuvent pas être modifiées

    // Utiliser une transaction pour mettre à jour les associations
    await prisma.$transaction(async (tx) => {
      // 1. Supprimer toutes les associations existantes pour les tarifs
      await tx.ticketingTierCustomFieldAssociation.deleteMany({
        where: { customFieldId },
      })

      // 2. Créer les nouvelles associations de tarifs
      if (tierIds && tierIds.length > 0) {
        for (const tierId of tierIds) {
          // Vérifier que le tarif existe et appartient à l'édition
          const existingTier = await tx.ticketingTier.findFirst({
            where: {
              id: tierId,
              editionId,
            },
          })

          if (!existingTier) {
            throw createError({
              status: 404,
              message: `Tarif ${tierId} introuvable`,
            })
          }

          await tx.ticketingTierCustomFieldAssociation.create({
            data: {
              tierId,
              customFieldId,
            },
          })
        }
      }

      // 3. Supprimer toutes les associations existantes pour les quotas
      await tx.ticketingTierCustomFieldQuota.deleteMany({
        where: { customFieldId },
      })

      // 4. Supprimer toutes les associations existantes pour les articles à restituer
      await tx.ticketingTierCustomFieldReturnableItem.deleteMany({
        where: { customFieldId },
      })

      // 5. Créer les nouvelles associations de quotas
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
              status: 404,
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

      // 6. Créer les nouvelles associations d'articles à restituer
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
              status: 404,
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

    return createSuccessResponse(null, 'Associations mises à jour avec succès')
  },
  { operationName: 'PUT ticketing custom field associations' }
)
