import { z } from 'zod'

import { isHttpError } from '#server/types/api'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionDataOrAccessControl } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  /** `true` solde la remise, `false` la rétablit — pour défaire une erreur sans quitter le guichet. */
  paidBack: z.boolean(),
})

/**
 * « A-t-on rendu à cette personne l'argent de sa remise ? »
 *
 * ⚠️ ACCORDER N'EST PAS RENDRE, exactement comme annuler n'est pas rembourser. Une remise accordée
 * sur une commande déjà réglée reste de l'argent qu'on doit tant que les espèces ne sont pas
 * sorties. Rien, avant ces colonnes, ne distinguait une remise rendue d'une remise promise.
 *
 * ## La garde est celle du CONTRÔLE D'ACCÈS, comme pour le remboursement
 *
 * Et pour la même raison, qui n'est pas un détail : c'est à la porte que la scène se joue. La
 * personne présente son billet, l'écran annonce la somme due, et c'est là qu'on la lui rend. Celui
 * qui tient le guichet doit pouvoir solder la dette devant elle, sans aller chercher un
 * responsable.
 *
 * 📍 ACCORDER la remise, en revanche, exige le droit de GESTION — c'est une décision, prise depuis
 * la page des commandes. Les deux gestes ne portent pas la même garde parce qu'ils ne se font ni
 * au même endroit ni par les mêmes personnes.
 *
 * ## Une case distincte de `refunded`
 *
 * `refunded` solde le prix ENTIER d'un billet annulé ; celle-ci solde la seule remise d'un billet
 * vivant. Un billet remisé puis annulé doit son prix entier MOINS la remise déjà rendue : avec une
 * case unique, rien ne dirait laquelle des deux sommes est sortie, et l'on rendrait deux fois — en
 * espèces, sans rattrapage.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)
    const itemId = validateResourceId(event, 'itemId', 'billet')

    const allowed = await canAccessEditionDataOrAccessControl(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    const { paidBack } = bodySchema.parse(await readBody(event))

    try {
      const item = await prisma.ticketingOrderItem.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          discountAmount: true,
          order: { select: { editionId: true } },
        },
      })

      if (!item) throw createError({ status: 404, message: 'Billet non trouvé' })

      if (item.order.editionId !== editionId)
        throw createError({ status: 403, message: "Ce billet n'appartient pas à cette édition" })

      /*
       * Solder suppose qu'il y ait une remise : sans quoi on enregistrerait avoir rendu une somme
       * que personne n'a accordée, et le guichet n'aurait aucun montant à annoncer. Défaire reste
       * permis sans condition — une remise retirée après coup doit pouvoir voir sa trace nettoyée.
       */
      if (paidBack && item.discountAmount <= 0)
        throw createError({
          status: 400,
          message: "Ce billet ne porte aucune remise : il n'y a rien à rendre",
        })

      await prisma.ticketingOrderItem.update({
        where: { id: itemId },
        data: paidBack
          ? {
              discountPaidBack: true,
              discountPaidBackAt: new Date(),
              discountPaidBackById: user.id,
            }
          : { discountPaidBack: false, discountPaidBackAt: null, discountPaidBackById: null },
      })

      return createSuccessResponse(null, paidBack ? 'Remise rendue' : 'Remise de nouveau à rendre')
    } catch (error: unknown) {
      if (isHttpError(error)) throw error
      console.error('Discount paid back error:', error)
      throw createError({
        status: 500,
        message: "Erreur lors de l'enregistrement de la remise rendue",
      })
    }
  },
  { operationName: 'PATCH ticketing order item discount paid back' }
)
