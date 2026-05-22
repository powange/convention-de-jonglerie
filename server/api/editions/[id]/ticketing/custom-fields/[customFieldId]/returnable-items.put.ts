import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  // Liste d'associations : un article par ligne, avec éventuellement une
  // valeur de réponse conditionnelle (utilisée pour les ChoiceList).
  items: z.array(
    z.object({
      returnableItemId: z.number().int().positive(),
      choiceValue: z.string().nullable().optional(),
    })
  ),
})

/**
 * PUT /api/editions/[id]/ticketing/custom-fields/[customFieldId]/returnable-items
 *
 * Met à jour uniquement les associations articles à restituer ↔ champ
 * personnalisé. Chaque association peut être globale (sans `choiceValue`)
 * ou conditionnée par une valeur de réponse précise.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const customFieldId = validateResourceId(event, 'customFieldId', 'custom field')

    const allowed = await canAccessEditionData(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const customField = await prisma.ticketingTierCustomField.findFirst({
      where: { id: customFieldId, editionId },
      select: { id: true },
    })
    if (!customField) {
      throw createError({ status: 404, message: 'Champ personnalisé introuvable' })
    }
    // Note : les associations articles à restituer peuvent être modifiées
    // même pour les champs personnalisés HelloAsso. Seules les propriétés du
    // champ lui-même (label, type, etc.) sont protégées.

    const { items } = bodySchema.parse(await readBody(event))

    if (items.length > 0) {
      const ids = Array.from(new Set(items.map((i) => i.returnableItemId)))
      const count = await prisma.ticketingReturnableItem.count({
        where: { id: { in: ids }, editionId },
      })
      if (count !== ids.length) {
        throw createError({
          status: 400,
          message: "Certains articles n'appartiennent pas à cette édition",
        })
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.ticketingTierCustomFieldReturnableItem.deleteMany({
        where: { customFieldId },
      })
      if (items.length > 0) {
        await tx.ticketingTierCustomFieldReturnableItem.createMany({
          data: items.map((i) => ({
            customFieldId,
            returnableItemId: i.returnableItemId,
            choiceValue: i.choiceValue || null,
          })),
        })
      }
    })

    return createSuccessResponse({ customFieldId, count: items.length })
  },
  { operationName: 'PUT ticketing custom-field returnable-items' }
)
