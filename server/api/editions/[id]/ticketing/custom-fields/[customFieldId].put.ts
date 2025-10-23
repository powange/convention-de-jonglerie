import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const bodySchema = z.object({
  label: z.string().min(1),
  type: z.enum(['TextInput', 'YesNo', 'ChoiceList', 'FreeText']),
  isRequired: z.boolean(),
  values: z.array(z.string()).optional(), // Pour ChoiceList
  tierIds: z.array(z.number()).optional(), // Tarifs associés
  quotas: z
    .array(
      z.object({
        quotaId: z.number(),
        choiceValue: z.string().optional(), // Pour ChoiceList
      })
    )
    .optional(),
  returnableItems: z
    .array(
      z.object({
        returnableItemId: z.number(),
        choiceValue: z.string().optional(), // Pour ChoiceList
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

  const body = bodySchema.parse(await readBody(event))

  try {
    // Vérifier que le custom field existe et appartient à l'édition
    const existingCustomField = await prisma.ticketingTierCustomField.findFirst({
      where: {
        id: customFieldId,
        editionId,
      },
    })

    if (!existingCustomField) {
      throw createError({
        statusCode: 404,
        message: 'Custom field introuvable',
      })
    }

    // Vérifier qu'il ne vient pas de HelloAsso (non modifiable)
    if (existingCustomField.helloAssoCustomFieldId !== null) {
      throw createError({
        statusCode: 403,
        message: 'Les custom fields synchronisés depuis HelloAsso ne peuvent pas être modifiés',
      })
    }

    // Mettre à jour le custom field dans une transaction
    const customField = await prisma.$transaction(async (tx) => {
      // Mettre à jour le custom field
      const cf = await tx.ticketingTierCustomField.update({
        where: { id: customFieldId },
        data: {
          label: body.label,
          type: body.type,
          isRequired: body.isRequired,
          values: body.values ? body.values : null,
        },
      })

      // Supprimer les anciennes associations avec les tarifs
      await tx.ticketingTierCustomFieldAssociation.deleteMany({
        where: { customFieldId },
      })

      // Créer les nouvelles associations avec les tarifs
      if (body.tierIds && body.tierIds.length > 0) {
        await tx.ticketingTierCustomFieldAssociation.createMany({
          data: body.tierIds.map((tierId) => ({
            tierId,
            customFieldId: cf.id,
          })),
        })
      }

      // Supprimer les anciennes associations avec les quotas
      await tx.ticketingTierCustomFieldQuota.deleteMany({
        where: { customFieldId },
      })

      // Créer les nouvelles associations avec les quotas
      if (body.quotas && body.quotas.length > 0) {
        await tx.ticketingTierCustomFieldQuota.createMany({
          data: body.quotas.map((q) => ({
            customFieldId: cf.id,
            quotaId: q.quotaId,
            choiceValue: q.choiceValue || null,
          })),
        })
      }

      // Supprimer les anciennes associations avec les articles à restituer
      await tx.ticketingTierCustomFieldReturnableItem.deleteMany({
        where: { customFieldId },
      })

      // Créer les nouvelles associations avec les articles à restituer
      if (body.returnableItems && body.returnableItems.length > 0) {
        await tx.ticketingTierCustomFieldReturnableItem.createMany({
          data: body.returnableItems.map((ri) => ({
            customFieldId: cf.id,
            returnableItemId: ri.returnableItemId,
            choiceValue: ri.choiceValue || null,
          })),
        })
      }

      // Retourner le custom field avec ses relations
      return await tx.ticketingTierCustomField.findUnique({
        where: { id: cf.id },
        include: {
          tiers: {
            include: {
              tier: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          quotas: {
            include: {
              quota: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
          returnableItems: {
            include: {
              returnableItem: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      })
    })

    return customField
  } catch (error: unknown) {
    console.error('Erreur lors de la modification du custom field:', error)
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      message: 'Erreur lors de la modification du custom field',
    })
  }
})
