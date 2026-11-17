import { wrapApiHandler } from '#server/utils/api-helpers'
import { requireAuth } from '#server/utils/auth-utils'
import { canManageTreasuryById } from '#server/utils/permissions/edition-permissions'
import { montantsDUneLigneSaisie } from '#server/utils/treasury-compute'
import { listerBeneficiaires } from '#server/utils/treasury-payees'
import { versementsAFaire } from '#server/utils/treasury-payouts'
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
     * Les lignes sont relues ici plutôt que reçues du client : un total de virement calculé sur ce
     * que l'écran a sous les yeux suivrait ses filtres, et afficherait « reste à verser » sur une
     * vue partielle. Ce chiffre-là doit porter sur toute l'édition.
     */
    const [entries, carnet] = await Promise.all([
      prisma.treasuryEntry.findMany({
        where: { editionId, kind: 'EXPENSE', payeeId: { not: null }, disbursed: false },
        select: {
          id: true,
          title: true,
          amount: true,
          isForecast: true,
          payeeId: true,
          disbursed: true,
          code: { select: { code: true, label: true } },
        },
      }),
      listerBeneficiaires(editionId),
    ])

    /*
     * ⚠️ `montantsDUneLigneSaisie` est IMPORTÉE, pas recopiée. Le montant d'une ligne prévisionnelle
     * vit dans `pending` et non dans `settled` : reproduire la règle ici ferait deux copies à tenir
     * en accord, et leur divergence donnerait un total juste dans sa forme et faux dans son chiffre.
     */
    const lignes = entries.map((entry) => ({
      key: `entry:${entry.id}`,
      kind: 'EXPENSE' as const,
      title: entry.title,
      ...montantsDUneLigneSaisie(entry.amount, entry.isForecast),
      code: entry.code,
      payeeId: entry.payeeId,
      disbursed: entry.disbursed,
    }))

    return createSuccessResponse(
      versementsAFaire(
        lignes as Parameters<typeof versementsAFaire>[0],
        carnet.map((b) => ({ id: b.id, label: b.label, iban: b.iban, bic: b.bic }))
      )
    )
  },
  { operationName: 'ListTreasuryPayouts' }
)
