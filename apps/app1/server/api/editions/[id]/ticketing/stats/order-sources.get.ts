import { wrapApiHandler, createSuccessResponse } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTicketingById } from '#server/utils/permissions/edition-permissions'
import { billetsQuiComptent } from '#server/utils/ticketing/billets-qui-comptent'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * La provenance des billets : saisis ici, ou importés d'une billetterie externe.
 *
 * ⚠️ TROIS DÉFAUTS, et le graphique s'affichait sans rien dire dans les trois cas.
 *
 * 1. AUCUN FILTRE DE STATUT. Une commande `Refunded` ou `Canceled` était comptée comme les autres.
 *    La provenance annonçait donc plus de billets que l'onglet « achats » du même écran, qui lui
 *    retient `Processed` et `Onsite` — deux chiffres côte à côte, tirés de la même base, qui ne se
 *    recoupaient pas.
 *
 * 2. « EXTERNE » ÉTAIT DÉFINI PAR `helloAssoOrderId`. Ce champ ne concerne que HelloAsso : une
 *    commande importée d'Infomaniak — l'autre fournisseur pris en charge — était comptée comme
 *    SAISIE À LA MAIN. Le graphique attribuait au guichet des billets vendus en ligne.
 *    `externalTicketingId` est la bonne clé, et c'est celle que `purchases.get.ts` emploie déjà.
 *
 * 3. LES LIGNES N'ÉTAIENT PAS TRIÉES. Un billet annulé (`state: 'Canceled'`) au sein d'une
 *    commande vivante comptait pour un billet vendu. `billetsQuiComptent` porte la règle commune.
 *
 * Et la garde était une réimplémentation : un `findUnique` de quarante lignes avec ses
 * `organizerPermissions`, suivi de `canManageTicketing(edition, user)`. `canManageTicketingById`
 * fait la même chose en une ligne, et c'est elle qui est tenue à jour.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTicketingById(editionId, user.id, event)
    if (!allowed) {
      throw createError({
        status: 403,
        message: 'Droits insuffisants pour accéder à cette fonctionnalité',
      })
    }

    const query = getQuery(event)
    const tierIds = query.tierIds
      ? (Array.isArray(query.tierIds) ? query.tierIds : [query.tierIds]).map(Number)
      : null

    /*
     * Le tri des LIGNES : la règle partagée, plus un filtre de tarifs quand l'écran en a choisi.
     *
     * `billetsQuiComptent` porte `order.editionId` et `order.status != 'Refunded'` ; on y ajoute
     * la restriction de statut de `purchases.get.ts`, pour que les deux graphiques du même écran
     * comptent la même chose. `Refunded` est alors exclu deux fois — par la règle commune et par
     * cette liste —, ce qui est sans conséquence et vaut mieux que de choisir entre les deux.
     */
    const regleDesBillets = billetsQuiComptent(editionId)
    const whereLignes = {
      ...regleDesBillets,
      order: {
        ...regleDesBillets.order,
        status: { in: ['Processed', 'Onsite'] },
      },
      ...(tierIds ? { tierId: { in: tierIds } } : {}),
    }

    /*
     * ⚠️ QUATRE COMPTAGES, et non une lecture de toutes les commandes suivie d'un tri en mémoire.
     *
     * L'ancien code chargeait TOUTES les commandes de l'édition avec toutes leurs lignes, pour
     * n'en garder que des longueurs de tableau. Sur une édition à plusieurs milliers de billets,
     * c'est un transfert complet pour produire quatre nombres.
     *
     * Les commandes se comptent séparément des lignes : une commande « compte » dès qu'elle
     * contient au moins une ligne retenue. Le dire en `some` est ce qui évite de recompter une
     * commande par ligne.
     */
    const [lignesManuelles, lignesExternes, commandesManuelles, commandesExternes] =
      await Promise.all([
        prisma.ticketingOrderItem.count({
          where: { ...whereLignes, order: { ...whereLignes.order, externalTicketingId: null } },
        }),
        prisma.ticketingOrderItem.count({
          where: {
            ...whereLignes,
            order: { ...whereLignes.order, externalTicketingId: { not: null } },
          },
        }),
        prisma.ticketingOrder.count({
          where: {
            editionId,
            status: { in: ['Processed', 'Onsite'] },
            externalTicketingId: null,
            // Une commande ne compte que si elle contient au moins une ligne retenue : sans cela,
            // une commande dont tous les billets sont annulés gonflerait le total.
            items: { some: whereLignes },
          },
        }),
        prisma.ticketingOrder.count({
          where: {
            editionId,
            status: { in: ['Processed', 'Onsite'] },
            externalTicketingId: { not: null },
            items: { some: whereLignes },
          },
        }),
      ])

    return createSuccessResponse({
      items: {
        manual: lignesManuelles,
        external: lignesExternes,
        total: lignesManuelles + lignesExternes,
      },
      orders: {
        manual: commandesManuelles,
        external: commandesExternes,
        total: commandesManuelles + commandesExternes,
      },
    })
  },
  { operationName: 'GetTicketingOrderSources' }
)
