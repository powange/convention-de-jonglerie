import { describe, expect, it } from 'vitest'

import type { TreasuryLine } from '../../../server/utils/treasury-compute'
import { versementsAFaire } from '../../../server/utils/treasury-payouts'

/**
 * Les versements à faire : ce que l'édition doit à des TIERS.
 *
 * ## ⚠️ LES DEUX DÉFAUTS QUE CES CAS ATTRAPENT
 *
 * 1. **Une ligne prévisionnelle comptée pour zéro.** Une dépense à régler non encore payée porte
 *    son montant dans `pending`, pas dans `settled`. Ne lire que `settled` donnerait un total
 *    juste dans sa forme et dramatiquement sous-évalué — et c'est le cas le PLUS COURANT de la
 *    fonctionnalité : un devis signé non encore viré.
 * 2. **Deux virements pour un seul compte.** Deux fiches peuvent porter le même IBAN — un
 *    prestataire saisi deux fois sous deux noms. Regrouper par identifiant de fiche produirait
 *    deux ordres de virement là où un seul est dû.
 *
 * ## L'asymétrie avec les avances, qui est volontaire
 *
 * `avancesARembourser` EXCLUT les lignes prévisionnelles : rien n'est sorti de la poche de
 * personne. Ici c'est l'inverse. Les deux règles se ressemblent et disent le contraire : c'est
 * exactement le genre d'endroit où une « harmonisation » casserait tout en silence.
 */
const ligne = (surcharges: Partial<TreasuryLine> = {}): TreasuryLine =>
  ({
    key: 'e1',
    kind: 'EXPENSE',
    title: 'Location de chapiteau',
    settled: 100_00,
    pending: 0,
    code: null,
    payeeId: 1,
    disbursed: false,
    ...surcharges,
  }) as TreasuryLine

const CARNET = [
  { id: 1, label: 'Chapiteaux du Sud', iban: 'FR7630001007941234567890185', bic: 'BNPAFRPP' },
  { id: 2, label: 'Salle des fêtes', iban: null, bic: null },
  // Même compte que la fiche 1, saisi sous un autre nom et avec des espaces.
  { id: 3, label: 'SARL Chapiteaux', iban: 'FR76 3000 1007 9412 3456 7890 185', bic: 'BNPAFRPP' },
]

describe('versementsAFaire', () => {
  it('totalise une dépense à régler', () => {
    const resultat = versementsAFaire([ligne()], CARNET)

    expect(resultat.total).toBe(100_00)
    expect(resultat.destinataires).toHaveLength(1)
    expect(resultat.destinataires[0]!.label).toBe('Chapiteaux du Sud')
  })

  it('⚠️ compte une ligne PRÉVISIONNELLE, dont le montant est dans `pending`', () => {
    /*
     * LE cas. Une dépense à régler non encore payée est exactement ce que la carte doit annoncer.
     * Ne lire que `settled` la compterait pour zéro : le total serait juste dans sa forme et
     * dramatiquement sous-évalué, sans qu'aucune erreur ne le dise.
     */
    const resultat = versementsAFaire([ligne({ settled: 0, pending: 250_00 })], CARNET)

    expect(resultat.total).toBe(250_00)
  })

  it('📍 additionne le réglé et l’engagé d’une même ligne', () => {
    const resultat = versementsAFaire([ligne({ settled: 40_00, pending: 60_00 })], CARNET)

    expect(resultat.total).toBe(100_00)
  })

  it('⚠️ regroupe DEUX FICHES qui portent le même IBAN', () => {
    /*
     * Le second cas qui porte le lot. Un prestataire saisi deux fois sous deux noms doit recevoir
     * UN virement, pas deux. Le regroupement se fait sur l'IBAN normalisé — « FR76 3000… » et
     * « FR7630001007… » sont le même compte.
     */
    const resultat = versementsAFaire(
      [ligne({ key: 'e1', payeeId: 1 }), ligne({ key: 'e2', payeeId: 3, settled: 50_00 })],
      CARNET
    )

    expect(resultat.destinataires).toHaveLength(1)
    expect(resultat.destinataires[0]!.montant).toBe(150_00)
    expect(resultat.destinataires[0]!.lignes).toHaveLength(2)
  })

  it('📍 mais NE regroupe PAS deux fiches sans coordonnées bancaires', () => {
    /*
     * Le témoin inverse, et le sens dangereux : fusionner deux fiches sans IBAN reviendrait à les
     * confondre sur la foi d'une homonymie, et à ne faire qu'un virement là où deux sont dus.
     */
    const carnet = [
      { id: 2, label: 'Salle des fêtes', iban: null, bic: null },
      { id: 4, label: 'Salle des fêtes (annexe)', iban: null, bic: null },
    ]
    const resultat = versementsAFaire(
      [ligne({ key: 'e1', payeeId: 2 }), ligne({ key: 'e2', payeeId: 4 })],
      carnet
    )

    expect(resultat.destinataires).toHaveLength(2)
  })

  it('⚠️ écarte ce qui est DÉJÀ versé', () => {
    const resultat = versementsAFaire([ligne({ disbursed: true })], CARNET)

    expect(resultat.total).toBe(0)
    expect(resultat.destinataires).toHaveLength(0)
  })

  it('⚠️ écarte les RECETTES et les lignes sans destinataire', () => {
    /*
     * Une recette n'est versée à personne, et une dépense sans bénéficiaire n'est pas à régler —
     * elle est soit déjà payée, soit avancée par quelqu'un, et relève alors de l'autre carte.
     */
    const resultat = versementsAFaire(
      [ligne({ kind: 'INCOME' }), ligne({ key: 'e2', payeeId: null })],
      CARNET
    )

    expect(resultat.total).toBe(0)
  })

  it('📍 garde un montant dû même si le bénéficiaire manque au carnet', () => {
    /*
     * La clé étrangère l'empêche en principe. Mais l'ignorer ferait DISPARAÎTRE un montant dû, et
     * un total qui s'allège tout seul ne se remarque pas. On le garde, sous son identifiant.
     */
    const resultat = versementsAFaire([ligne({ payeeId: 99 })], CARNET)

    expect(resultat.total).toBe(100_00)
    expect(resultat.destinataires[0]!.label).toBe('#99')
  })

  it('📍 trie par montant décroissant, dedans comme dehors', () => {
    const resultat = versementsAFaire(
      [
        ligne({ key: 'e1', payeeId: 2, settled: 10_00 }),
        ligne({ key: 'e2', payeeId: 1, settled: 30_00 }),
        ligne({ key: 'e3', payeeId: 1, settled: 70_00 }),
      ],
      CARNET
    )

    expect(resultat.destinataires[0]!.montant).toBe(100_00)
    expect(resultat.destinataires[0]!.lignes[0]!.montant).toBe(70_00)
    expect(resultat.destinataires[1]!.montant).toBe(10_00)
  })
})
