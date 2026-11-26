import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { userBasicSelect } from '#server/utils/prisma-select-helpers'
import { montantsDUneLigneSaisie } from '#server/utils/treasury-compute'
import { versementsAFaire } from '#server/utils/treasury-payouts'
import { artistesAVerser, depensesAVerser } from '#server/utils/treasury-payouts-sources'
import { validateEditionId } from '#server/utils/validation-helpers'

/**
 * Les versements à faire : ce que l'édition doit à des tiers, prêt à virer.
 *
 * ## Pourquoi un point d'API à part
 *
 * ⚠️ C'est le SEUL de la trésorerie qui rende des IBAN. La lecture générale
 * (`/treasury`) alimente aussi des écrans de consultation : y joindre les coordonnées bancaires les
 * ferait voyager à chaque rafraîchissement, pour tous ceux qui ouvrent la page. Ici elles ne
 * partent que lorsqu'on ouvre le détail des versements, c'est-à-dire au moment de virer.
 *
 * 📍 À ne pas confondre avec les AVANCES, que `/treasury` totalise déjà : celles-ci sont dues à des
 * gens de l'équipe qui ont payé de leur poche, celles-là à des tiers extérieurs. L'invariant du lot
 * précédent garantit qu'une ligne n'appartient jamais aux deux.
 */
export default wrapApiHandler(
  async (event) => {
    const user = requireAuth(event)
    const editionId = validateEditionId(event)

    const allowed = await canManageTreasuryById(editionId, user.id, event)
    if (!allowed) {
      throw createError({ status: 403, message: 'Droits insuffisants pour gérer la trésorerie' })
    }

    /*
     * Les deux sources sont relues ici plutôt que reçues du client : un total de virement calculé
     * sur ce que l'écran a sous les yeux suivrait ses filtres, et afficherait « reste à verser »
     * sur une vue partielle. Ce chiffre-là doit porter sur toute l'édition.
     */
    const [depenses, artistes] = await Promise.all([
      prisma.treasuryEntry.findMany({
        where: { editionId, kind: 'EXPENSE', payeeId: { not: null }, disbursed: false },
        select: {
          id: true,
          title: true,
          amount: true,
          isForecast: true,
          code: { select: { code: true, label: true } },
          payee: { select: { id: true, label: true, iban: true, bic: true } },
        },
      }),
      /*
       * ⚠️ LES IBAN DES ARTISTES SONT LUS ICI, sous le seul droit trésorerie.
       *
       * Le schéma les réservait à `canManageArtistsById`. L'élargissement est une décision
       * explicite du 17/11/2026 : c'est le trésorier qui exécute les virements, lui refuser l'IBAN
       * lui ferait voir un versement à faire sans pouvoir le faire. La garde reste étroite — ce
       * point d'API est le SEUL de la trésorerie à en rendre, la lecture générale n'en rend aucun.
       *
       * 📍 On ne filtre pas sur « a un IBAN » : un artiste à payer dont on n'a pas les coordonnées
       * doit apparaître, justement pour qu'on sache qu'il faut les lui demander. Les écarter ferait
       * disparaître une dette du total.
       */
      prisma.editionArtist.findMany({
        where: {
          editionId,
          OR: [
            { paymentPaid: false, payment: { gt: 0 } },
            { reimbursementActualPaid: false, reimbursementActual: { gt: 0 } },
            { consumablesActualPaid: false, consumablesActual: { gt: 0 } },
          ],
        },
        select: {
          id: true,
          /*
           * ⚠️ Le nom vient du COMPTE, pas de la fiche : `EditionArtist` porte un `userId` et
           * aucun nom propre. Le supposer aurait produit une erreur Prisma à l'exécution — ou,
           * pire, un libellé vide sur un ordre de virement.
           */
          user: { select: userBasicSelect },
          iban: true,
          bic: true,
          payment: true,
          paymentPaid: true,
          reimbursementActual: true,
          reimbursementActualPaid: true,
          consumablesActual: true,
          consumablesActualPaid: true,
        },
      }),
    ])

    /*
     * ⚠️ `montantsDUneLigneSaisie` est IMPORTÉE, pas recopiée : le montant d'une ligne
     * prévisionnelle vit dans `pending` et non dans `settled`. Les deux parts sont additionnées
     * parce qu'une dépense à régler est due qu'elle soit déjà engagée ou seulement prévue.
     */
    const elements = [
      ...depensesAVerser(
        depenses.map((depense) => {
          const parts = montantsDUneLigneSaisie(depense.amount, depense.isForecast)
          return {
            id: depense.id,
            title: depense.title,
            montant: parts.settled + parts.pending,
            code: depense.code,
            payee: depense.payee,
          }
        })
      ),
      ...artistesAVerser(
        artistes.map((artiste) => ({
          id: artiste.id,
          // Un pseudo manquant ne doit pas donner un ordre de virement anonyme : on retombe sur
          // l'identifiant de la fiche, qui permet au moins de retrouver de qui il s'agit.
          nom: artiste.user?.pseudo || `Artiste #${artiste.id}`,
          iban: artiste.iban,
          bic: artiste.bic,
          payment: artiste.payment,
          paymentPaid: artiste.paymentPaid,
          reimbursementActual: artiste.reimbursementActual,
          reimbursementActualPaid: artiste.reimbursementActualPaid,
          consumablesActual: artiste.consumablesActual,
          consumablesActualPaid: artiste.consumablesActualPaid,
        }))
      ),
    ]

    return createSuccessResponse(versementsAFaire(elements))
  },
  { operationName: 'ListTreasuryPayouts' }
)
