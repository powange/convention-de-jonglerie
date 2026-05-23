import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionData } from '#server/utils/permissions/edition-permissions'

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
  handoutItems: z
    .array(
      z.object({
        handoutItemId: z.number(),
        choiceValue: z.string().optional(), // Pour ChoiceList
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

    // Vérifier que le custom field existe et appartient à l'édition
    const existingCustomField = await prisma.ticketingTierCustomField.findFirst({
      where: {
        id: customFieldId,
        editionId,
      },
    })

    if (!existingCustomField) {
      throw createError({
        status: 404,
        message: 'Custom field introuvable',
      })
    }

    // Vérifier qu'il ne vient pas de HelloAsso (non modifiable)
    if (existingCustomField.helloAssoCustomFieldId !== null) {
      throw createError({
        status: 403,
        message: 'Les custom fields synchronisés depuis HelloAsso ne peuvent pas être modifiés',
      })
    }

    // Le type d'un champ personnalisé est verrouillé après création :
    // changer un ChoiceList en autre type laisserait des associations
    // (quotas / articles à remettre) orphelines pointant vers des
    // `choiceValue` qui n'existent plus.
    if (body.type !== existingCustomField.type) {
      throw createError({
        status: 400,
        message:
          "Le type d'un champ personnalisé ne peut pas être modifié après sa création. Supprimez-le et recréez-en un nouveau si besoin.",
      })
    }

    // Pour un ChoiceList : repérer les valeurs supprimées par rapport à
    // l'existant pour pouvoir nettoyer les associations orphelines.
    const newValues = body.values ?? []
    const oldValues = Array.isArray(existingCustomField.values)
      ? (existingCustomField.values as string[])
      : []
    const removedValues =
      body.type === 'ChoiceList' && body.values !== undefined
        ? oldValues.filter((v) => !newValues.includes(v))
        : []

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

      // Nettoyer les associations orphelines : si on a retiré des valeurs
      // de la ChoiceList, on supprime les associations quotas / articles
      // qui ciblaient ces valeurs (on garde celles avec `choiceValue = null`
      // qui signifient « tous les choix »).
      if (removedValues.length > 0) {
        await tx.ticketingTierCustomFieldQuota.deleteMany({
          where: { customFieldId, choiceValue: { in: removedValues } },
        })
        await tx.ticketingTierCustomFieldHandoutItem.deleteMany({
          where: { customFieldId, choiceValue: { in: removedValues } },
        })
      }

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

      // Supprimer / recréer les associations articles à remettre uniquement
      // si la clé est explicitement fournie (édition désormais déléguée à
      // un endpoint dédié).
      if (body.handoutItems !== undefined) {
        await tx.ticketingTierCustomFieldHandoutItem.deleteMany({
          where: { customFieldId },
        })
        if (body.handoutItems.length > 0) {
          await tx.ticketingTierCustomFieldHandoutItem.createMany({
            data: body.handoutItems.map((ri) => ({
              customFieldId: cf.id,
              handoutItemId: ri.handoutItemId,
              choiceValue: ri.choiceValue || null,
            })),
          })
        }
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
          handoutItems: {
            include: {
              handoutItem: {
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

    return createSuccessResponse(customField)
  },
  { operationName: 'PUT ticketing custom field' }
)
