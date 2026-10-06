import { z } from 'zod'

import { isHttpError } from '#server/types/api'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'
import { montantBrutDeLaLigne } from '~~/shared/utils/remise-de-ligne'

const bodySchema = z.object({
  /**
   * La remise accordée, **en centimes**. `0` la retire.
   *
   * ⚠️ Entier : une remise en euros décimaux ferait un montant cent fois trop petit en base, et
   * un encaissé faux ne se remarque pas tout de suite. `.int()` refuse `12.5` plutôt que de
   * l'arrondir en silence.
   */
  discountAmount: z.number().int().min(0),
})

/**
 * « Quelle remise accorde-t-on sur ce billet ? »
 *
 * ⚠️ UNE REMISE N'EST PAS UNE ANNULATION. Le billet reste VIVANT : droit d'entrée, repas, articles
 * à remettre, quotas, rien ne change. On rend seulement une partie du prix — un geste commercial,
 * une erreur de tarif, un dédommagement.
 *
 * ## Elle pèse sur les comptes, contrairement au remboursement
 *
 * Le remboursement d'un billet annulé n'a aucun effet comptable, et c'est écrit tel quel dans
 * `refund.patch.ts` : l'annulation a déjà retiré la totalité du montant avant lui. Rien n'a été
 * retiré d'un billet vivant — une remise invisible laisserait l'encaissé au prix plein et le ferait
 * mentir du montant rendu, sans erreur ni alerte, jusqu'au bilan.
 *
 * ## Le droit de GESTION, et non celui du guichet
 *
 * Rembourser se fait à la porte, devant la personne à qui l'on rend son argent : le contrôle
 * d'accès suffit. Accorder une remise est une décision, prise depuis la page des commandes — d'où
 * le même droit que l'annulation, sa voisine immédiate.
 *
 * ## Le système ENREGISTRE, il ne rembourse pas
 *
 * HelloAsso ne sait pas rembourser partiellement. Le mouvement d'argent se fait donc à la main, et
 * ce point d'API n'en garde que la trace.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)

    const editionId = validateEditionId(event)
    const itemId = validateResourceId(event, 'itemId', 'billet')

    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed)
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })

    const { discountAmount } = bodySchema.parse(await readBody(event))

    try {
      const item = await prisma.ticketingOrderItem.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          state: true,
          amount: true,
          selectedOptions: { select: { amount: true } },
          order: { select: { editionId: true } },
        },
      })

      if (!item) throw createError({ status: 404, message: 'Billet non trouvé' })

      if (item.order.editionId !== editionId)
        throw createError({ status: 403, message: "Ce billet n'appartient pas à cette édition" })

      /*
       * ⚠️ PAS DE REMISE SUR UN BILLET ANNULÉ, et c'est le miroir exact de la règle du
       * remboursement, qui exige l'inverse. Le montant d'un billet annulé a déjà quitté l'encaissé
       * en entier : une remise par-dessus le soustrairait une seconde fois, et le produit baisserait
       * d'une somme qui n'est jamais sortie de la caisse. C'est le remboursement qu'on enregistre
       * dans ce cas-là, pas une remise.
       */
      if (discountAmount > 0 && item.state === 'Canceled')
        throw createError({
          status: 400,
          message:
            "Ce billet est annulé : son montant a déjà quitté les comptes. Enregistrez un remboursement plutôt qu'une remise.",
        })

      /*
       * ⚠️ PLAFONNÉE AU PRIX, OPTIONS COMPRISES, et REFUSÉE plutôt que rognée. La règle pure
       * plafonne aussi, mais en défense : ici on dit non, parce qu'une saisie acceptée puis
       * silencieusement réduite laisserait croire qu'on a rendu plus qu'on ne l'a fait.
       */
      const brut = montantBrutDeLaLigne(item)
      if (discountAmount > brut)
        throw createError({
          status: 400,
          message: `La remise ne peut pas dépasser le prix du billet (${(brut / 100).toFixed(2)} €)`,
        })

      await prisma.ticketingOrderItem.update({
        where: { id: itemId },
        data:
          discountAmount > 0
            ? { discountAmount, discountedAt: new Date(), discountedById: user.id }
            : // Retirer la remise efface aussi sa trace : garder un auteur sur une remise nulle
              // ferait lire « remise accordée par X » là où il n'y en a plus.
              { discountAmount: 0, discountedAt: null, discountedById: null },
      })

      return createSuccessResponse(
        { discountAmount },
        discountAmount > 0 ? 'Remise enregistrée' : 'Remise retirée'
      )
    } catch (error: unknown) {
      if (isHttpError(error)) throw error
      console.error('Discount order item error:', error)
      throw createError({
        status: 500,
        message: "Erreur lors de l'enregistrement de la remise",
      })
    }
  },
  { operationName: 'PATCH ticketing order item discount' }
)
