import { z } from 'zod'

import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

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
     * Dédoublonnage sur le COUPLE (quota, choix).
     *
     * L'unicité en base porte sur `(customFieldId, quotaId, choiceValue)` : le même quota peut
     * légitimement apparaître deux fois s'il vise deux réponses différentes. Dédoublonner sur le
     * seul quota en perdrait une.
     */
    const vues = new Set<string>()
    const associations = body.quotas.filter((association) => {
      const cle = `${association.quotaId}::${association.choiceValue ?? ''}`
      if (vues.has(cle)) return false
      vues.add(cle)
      return true
    })

    const quotaIds = [...new Set(associations.map((a) => a.quotaId))]
    if (quotaIds.length > 0) {
      const nombre = await prisma.ticketingQuota.count({
        where: { id: { in: quotaIds }, editionId },
      })
      if (nombre !== quotaIds.length) {
        throw createError({
          status: 400,
          message: "Certains quotas n'appartiennent pas à cette édition",
        })
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.ticketingTierCustomFieldQuota.deleteMany({ where: { customFieldId } })
      if (associations.length > 0) {
        await tx.ticketingTierCustomFieldQuota.createMany({
          data: associations.map(({ quotaId, choiceValue }) => ({
            customFieldId,
            quotaId,
            choiceValue: choiceValue ?? null,
          })),
        })
      }
    })

    return createSuccessResponse({ customFieldId, quotas: associations })
  },
  { operationName: 'PUT ticketing custom-field quotas' }
)
