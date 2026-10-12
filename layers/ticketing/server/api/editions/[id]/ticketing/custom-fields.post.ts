import { z } from 'zod'

import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { Prisma } from '#server/utils/prisma'
import { dedoublonnerAssociations } from '~~/shared/utils/dedoublonnage-associations'

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

    // Vérifier les permissions
    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
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
          // `Prisma.DbNull` et non `null` : Prisma refuse un null brut sur un champ `Json?`,
          // et la création d'un champ personnalisé sans valeurs échouait donc.
          values: body.values ?? Prisma.DbNull,
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

      /*
       * ⚠️ LES DEUX LISTES SONT DÉDOUBLONNÉES SUR LEUR CLÉ D'UNICITÉ — constat O3. Le corps
       * partait tel quel dans `createMany`, et `choiceValue` étant nullable, l'unicité ne
       * protège pas la ligne « tous les choix » : deux NULL sont distincts sous MySQL. Deux fois
       * le même quota, ou le même article, sans choix précis créaient deux lignes identiques.
       */
      // Associer aux quotas si fournis
      if (body.quotas && body.quotas.length > 0) {
        await tx.ticketingTierCustomFieldQuota.createMany({
          data: dedoublonnerAssociations(body.quotas, (q) => [
            q.quotaId,
            q.choiceValue || null,
          ]).map((q) => ({
            customFieldId: cf.id,
            quotaId: q.quotaId,
            choiceValue: q.choiceValue || null,
          })),
        })
      }

      // Associer aux articles à remettre si fournis
      if (body.handoutItems && body.handoutItems.length > 0) {
        await tx.ticketingTierCustomFieldHandoutItem.createMany({
          data: dedoublonnerAssociations(body.handoutItems, (ri) => [
            ri.handoutItemId,
            ri.choiceValue || null,
          ]).map((ri) => ({
            customFieldId: cf.id,
            handoutItemId: ri.handoutItemId,
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
  { operationName: 'POST ticketing custom field' }
)
