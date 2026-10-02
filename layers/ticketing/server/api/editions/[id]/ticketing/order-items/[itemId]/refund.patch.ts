import { z } from 'zod'

import { isHttpError } from '#server/types/api'
import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canAccessEditionDataOrAccessControl } from '#server/utils/permissions/edition-permissions'
import { validateEditionId, validateResourceId } from '#server/utils/validation-helpers'

const bodySchema = z.object({
  refunded: z.boolean(),
  /**
   * Ce que le geste solde : ce billet seul, ou toutes les lignes dues de sa commande.
   *
   * ⚠️ POURQUOI « COMMANDE » EXISTE. Au guichet, on rend l'argent UNE fois, à la personne en face.
   * N'offrir que « billet » faisait rendre 34 € sur une commande qui en devait 58 — quatre repas
   * annulés restaient dus, et il aurait fallu scanner chaque ligne pour les solder (commande 937,
   * base de développement).
   *
   * 📍 Le défaut reste `billet` : la liste des commandes, elle, solde bien ligne par ligne, et un
   * appel qui ne dit rien ne doit pas se mettre soudain à en solder cinq.
   */
  portee: z.enum(['billet', 'commande']).default('billet'),
})

/**
 * « A-t-on rendu l'argent à cette personne ? »
 *
 * **Annulé ne veut pas dire remboursé.** Un billet réglé puis annulé reste une dette tant que
 * personne n'a coché cette case — et rien, avant, ne permettait de la distinguer d'un billet
 * soldé.
 *
 * ## Pourquoi la garde est celle du contrôle d'accès, et non celle de la billetterie
 *
 * Parce que c'est à la porte que la scène se joue : la personne présente son billet, l'écran
 * refuse l'entrée, et c'est là qu'on lui rend son argent. Celui qui tient le guichet doit pouvoir
 * solder la dette devant elle, sans aller chercher un responsable.
 *
 * ⚠️ À savoir : enregistrer un PAIEMENT (`payment-method.patch.ts`) exige, lui, le droit de
 * gestion de la billetterie. Un bénévole peut donc rembourser mais pas encaisser — asymétrie
 * assumée le temps qu'elle soit tranchée, et non un oubli.
 *
 * ## Sans effet sur les comptes
 *
 * Le montant d'un billet annulé quitte l'encaissé dès l'annulation, remboursé ou non. Cette case
 * ne sert qu'à savoir **à qui l'on doit encore** — décision explicite, consignée pour qu'on ne la
 * reprenne pas plus tard pour un défaut.
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

    const body = bodySchema.parse(await readBody(event))

    try {
      const item = await prisma.ticketingOrderItem.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          orderId: true,
          state: true,
          refunded: true,
          order: { select: { editionId: true } },
        },
      })

      // Le billet suffit à s'adresser : son identifiant est unique, et l'édition est vérifiée
      // juste après. Exiger aussi celui de la commande rendrait la route inutilisable depuis le
      // contrôle d'accès, qui n'expose que l'identifiant HelloAsso — `null` sur une commande
      // saisie à la main.
      if (!item) throw createError({ status: 404, message: 'Billet non trouvé' })

      if (item.order.editionId !== editionId)
        throw createError({ status: 403, message: "Ce billet n'appartient pas à cette édition" })

      /*
       * Rembourser suppose d'avoir annulé : sans quoi on rendrait l'argent d'un billet qui donne
       * toujours droit d'entrée.
       *
       * 📍 La règle ne vaut QUE pour la portée « billet ». Sur toute une commande, c'est le
       * `updateMany` plus bas qui ne retient que les lignes annulées — et quelqu'un peut très bien
       * présenter son billet d'entrée valide alors que ses repas, eux, ont été annulés. Exiger ici
       * que le billet scanné soit annulé rendrait sa dette insoldable.
       */
      if (body.portee === 'billet' && body.refunded && item.state !== 'Canceled')
        throw createError({
          status: 400,
          message: "Ce billet n'est pas annulé : annulez-le avant d'enregistrer un remboursement",
        })

      const marque = body.refunded
        ? { refunded: true, refundedAt: new Date(), refundedById: user.id }
        : { refunded: false, refundedAt: null, refundedById: null }

      if (body.portee === 'billet') {
        await prisma.ticketingOrderItem.update({ where: { id: itemId }, data: marque })
        return createSuccessResponse(
          null,
          body.refunded ? 'Remboursement enregistré' : 'Remboursement annulé'
        )
      }

      /*
       * Toute la commande, en UN `updateMany` et non une boucle d'appels.
       *
       * ⚠️ Le `where` porte la condition, et c'est ce qui rend le geste sûr : seules les lignes
       * ANNULÉES et pas encore dans l'état voulu changent. Un billet valide de la même commande
       * n'est jamais touché — il donne toujours droit d'entrée —, et un double clic ne réécrit
       * rien puisque la seconde passe ne trouve plus personne.
       *
       * Les lignes annulées d'une commande groupée appartiennent parfois à des personnes
       * DIFFÉRENTES ; c'est l'écran qui refuse alors ce geste (`nomsMultiples`, dans
       * `remboursement-du.ts`), parce que lui seul sait qui se tient au guichet.
       */
      const { count } = await prisma.ticketingOrderItem.updateMany({
        where: {
          orderId: item.orderId,
          state: 'Canceled',
          refunded: !body.refunded,
        },
        data: marque,
      })

      return createSuccessResponse(
        { lignes: count },
        body.refunded ? 'Remboursement enregistré' : 'Remboursement annulé'
      )
    } catch (error: unknown) {
      if (isHttpError(error)) throw error
      console.error('Refund order item error:', error)
      throw createError({
        status: 500,
        message: "Erreur lors de l'enregistrement du remboursement",
      })
    }
  },
  { operationName: 'PATCH ticketing order item refund' }
)
