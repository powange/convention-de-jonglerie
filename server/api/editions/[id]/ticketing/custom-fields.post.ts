import { requireAuth } from '@@/server/utils/auth-utils'
import { canAccessEditionData } from '@@/server/utils/permissions/edition-permissions'
import { prisma } from '@@/server/utils/prisma'
import { z } from 'zod'

const bodySchema = z.object({
  label: z.string().min(1),
  type: z.enum(['TextInput', 'YesNo', 'ChoiceList', 'FreeText']),
  isRequired: z.boolean().default(false),
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

export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    // Vérifier les permissions
    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed)
      throw createError({
        statusCode: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    const body = bodySchema.parse(await readBody(event))

    // Créer le custom field dans une transaction
    const customField = await prisma.$transaction(async (tx) => {
      // Créer le custom field
      const cf = await tx.ticketingTierCustomField.create({
        data: {
          editionId,
          label: body.label,
          type: body.type,
          isRequired: body.isRequired,
          values: body.values ? body.values : null,
        },
      })

      // Associer aux tarifs si fournis
      if (body.tierIds && body.tierIds.length > 0) {
        await tx.ticketingTierCustomFieldAssociation.createMany({
          data: body.tierIds.map((tierId) => ({
            tierId,
            customFieldId: cf.id,
          })),
        })
      }

      // Associer aux quotas si fournis
      if (body.quotas && body.quotas.length > 0) {
        await tx.ticketingTierCustomFieldQuota.createMany({
          data: body.quotas.map((q) => ({
            customFieldId: cf.id,
            quotaId: q.quotaId,
            choiceValue: q.choiceValue || null,
          })),
        })
      }

      // Associer aux articles à restituer si fournis
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
  },
  { operationName: 'POST ticketing custom field' }
)
