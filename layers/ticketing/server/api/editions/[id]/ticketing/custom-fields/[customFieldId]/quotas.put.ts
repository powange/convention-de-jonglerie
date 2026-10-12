import { z } from 'zod'

import { assertQuotasDeLEdition } from '../../../../../../utils/quotas-appartenance'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'
import { dedoublonnerAssociations } from '~~/shared/utils/dedoublonnage-associations'

const bodySchema = z.object({
  quotas: z.array(
    z.object({
      quotaId: z.number().int(),
      /**
       * Le choix de réponse qui déclenche le quota, pour un champ de type liste.
       *
       * `null` — ou absent — signifie « quelle que soit la réponse ». Ce n'est pas la même chose
       * qu'une chaîne vide, qui serait une réponse à part entière.
       */
      choiceValue: z.string().nullable().optional(),
    })
  ),
})

/**
 * PUT /api/editions/[id]/ticketing/custom-fields/[customFieldId]/quotas
 *
 * Met à jour UNIQUEMENT les quotas associés à un champ personnalisé. Remplace l'ensemble.
 *
 * Troisième endpoint du même modèle, après ceux des tarifs et des options, et pour la même
 * raison : l'endpoint générique `/associations` efface aussi les associations de TARIFS sans
 * condition. N'y envoyer que les quotas les détruirait.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)
    const customFieldId = validateResourceId(event, 'customFieldId', 'custom field')

    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants' })
    }

    const champ = await prisma.ticketingTierCustomField.findFirst({
      where: { id: customFieldId, editionId },
      select: { id: true },
    })
    if (!champ) {
      throw createError({ status: 404, message: 'Champ personnalisé introuvable' })
    }

    const body = bodySchema.parse(await readBody(event))

    /**
     * Dédoublonnage sur le COUPLE (quota, choix) — constat O3.
     *
     * L'unicité en base porte sur `(customFieldId, quotaId, choiceValue)` : le même quota peut
     * légitimement apparaître deux fois s'il vise deux réponses différentes. Dédoublonner sur le
     * seul quota en perdrait une.
     *
     * 📍 La clé était composée ici à la main, et c'était la troisième écriture de cette règle
     * dans le dépôt — avec deux comportements différents sur l'occurrence retenue. Elle vient
     * maintenant d'un seul endroit.
     *
     * 📍 Et la chaîne VIDE est désormais traitée comme « tous les choix » (`|| null`), comme aux
     * quatre autres points d'écriture. Ce point-ci était le seul à l'écrire telle quelle
     * (`?? null`), donc à la ranger comme un choix nommé — alors que sa clé de dédoublonnage,
     * elle, la confondait déjà avec `null`. Les deux moitiés étaient en désaccord ; un choix
     * dont le libellé est vide n'existe pas.
     */
    const associations = dedoublonnerAssociations(body.quotas, (association) => [
      association.quotaId,
      association.choiceValue || null,
    ])

    await assertQuotasDeLEdition(
      editionId,
      associations.map((association) => association.quotaId)
    )

    await prisma.$transaction(async (tx) => {
      await tx.ticketingTierCustomFieldQuota.deleteMany({ where: { customFieldId } })
      if (associations.length > 0) {
        await tx.ticketingTierCustomFieldQuota.createMany({
          data: associations.map(({ quotaId, choiceValue }) => ({
            customFieldId,
            quotaId,
            choiceValue: choiceValue || null,
          })),
        })
      }
    })

    return createSuccessResponse({ customFieldId, quotas: associations })
  },
  { operationName: 'PUT ticketing custom-field quotas' }
)
