import { describe, expect, it } from 'vitest'

import {
  artistesAVerser,
  depensesAVerser,
  type ArtisteAPayer,
  type DepenseARegler,
} from '../../../server/utils/treasury-payouts-sources'
import { versementsAFaire, type ElementAVerser } from '../../../server/utils/treasury-payouts'

/**
 * Les versements à faire : ce que l'édition doit à des tiers, toutes origines confondues.
 *
 * ## ⚠️ LES DÉFAUTS QUE CES CAS ATTRAPENT
 *
 * 1. **Deux virements pour un seul compte.** Deux fiches peuvent porter le même IBAN — un
 *    prestataire saisi deux fois, ou un artiste qui facture aussi une prestation. Regrouper par
 *    identité produirait deux ordres de virement là où un seul est dû.
 * 2. **Un plafond viré comme s'il était dû.** Un défraiement non justifié n'est connu que par son
 *    maximum. Le virer reviendrait à payer une somme qu'on ne connaît pas, puis à réclamer la
 *    différence.
 * 3. **Une somme déjà versée qui compte encore**, ou une somme due qui disparaît : les trois
 *    montants d'un artiste portent chacun leur drapeau, et les lier casserait l'un ou l'autre.
 */
const IBAN_A = 'FR7630001007941234567890185'

const element = (surcharges: Partial<ElementAVerser> = {}): ElementAVerser => ({
  cle: 'e1',
  libelle: 'Location de chapiteau',
  montant: 100_00,
  code: null,
  destinataire: {
    id: 'payee:1',
    label: 'Chapiteaux du Sud',
    iban: IBAN_A,
    bic: 'BNPAFRPP',
    origine: 'payee',
  },
  ...surcharges,
})

describe('versementsAFaire', () => {
  it('totalise un versement', () => {
    const resultat = versementsAFaire([element()])

    expect(resultat.total).toBe(100_00)
    expect(resultat.destinataires[0]!.label).toBe('Chapiteaux du Sud')
  })

  it('⚠️ regroupe deux éléments qui portent le même IBAN, même ÉCRIT DIFFÉREMMENT', () => {
    /*
     * « FR76 3000… » et « FR7630001007… » sont le même compte. Sans normalisation à la clé, on
     * ferait deux virements pour un seul bénéficiaire.
     */
    const resultat = versementsAFaire([
      element(),
      element({
        cle: 'e2',
        montant: 50_00,
        destinataire: {
          id: 'payee:3',
          label: 'SARL Chapiteaux',
          iban: 'FR76 3000 1007 9412 3456 7890 185',
          bic: 'BNPAFRPP',
          origine: 'payee',
        },
      }),
    ])

    expect(resultat.destinataires).toHaveLength(1)
    expect(resultat.destinataires[0]!.montant).toBe(150_00)
  })

  it('⚠️ regroupe un ARTISTE et un PRESTATAIRE qui partagent un compte, et le dit', () => {
    /*
     * Le cas que la généralisation rend possible : un collectif qui facture pour l'un de ses
     * membres. C'est UN virement. L'origine devient « mixte » pour que l'écran ne prétende pas
     * qu'il ne solde qu'un cachet alors qu'il solde aussi une facture.
     */
    const resultat = versementsAFaire([
      element(),
      element({
        cle: 'a1',
        montant: 300_00,
        destinataire: {
          id: 'artist:9',
          label: 'Cie des Balles',
          iban: IBAN_A,
          bic: 'BNPAFRPP',
          origine: 'artist',
        },
      }),
    ])

    expect(resultat.destinataires).toHaveLength(1)
    expect(resultat.destinataires[0]!.origine).toBe('mixte')
    expect(resultat.destinataires[0]!.montant).toBe(400_00)
  })

  it('📍 NE regroupe PAS deux destinataires sans IBAN', () => {
    /*
     * Le témoin inverse, et le sens dangereux : les fusionner reviendrait à les confondre sur une
     * homonymie, et à ne faire qu'un virement là où deux sont dus.
     */
    const sansIban = (id: string, label: string) =>
      element({
        cle: id,
        destinataire: { id, label, iban: null, bic: null, origine: 'payee' as const },
      })

    const resultat = versementsAFaire([sansIban('payee:2', 'Salle'), sansIban('payee:4', 'Salle')])

    expect(resultat.destinataires).toHaveLength(2)
  })

  it('⚠️ un bénéficiaire et un artiste de même numéro ne se confondent pas', () => {
    /*
     * ⚠️ CE CAS PASSE PAR LES TRADUCTEURS, et non par des identités écrites à la main : sinon il
     * vérifierait que `versementsAFaire` distingue deux chaînes différentes — ce qui ne fait aucun
     * doute — au lieu de vérifier ce que `depensesAVerser` et `artistesAVerser` produisent.
     *
     * 📍 CE QU'IL ATTRAPE EXACTEMENT, mesuré par sabotage : une convention d'identité COMMUNE aux
     * deux sources. Retirer un seul des deux préfixes ne le fait pas tomber, et c'est normal —
     * `7` et `payee:7` restent distincts. Il tombe quand les deux adoptent le même format, cas où
     * le bénéficiaire 7 et l'artiste 7 se regrouperaient sans IBAN : un seul virement là où deux
     * sont dus, à deux personnes différentes.
     */
    const elements = [
      ...depensesAVerser([
        {
          id: 1,
          title: 'Location',
          montant: 100_00,
          code: null,
          payee: { id: 7, label: 'Fournisseur', iban: null, bic: null },
        },
      ]),
      ...artistesAVerser([
        {
          id: 7,
          nom: 'Jongleur',
          iban: null,
          bic: null,
          payment: 200_00,
          paymentPaid: false,
          reimbursementActual: null,
          reimbursementActualPaid: false,
          consumablesActual: null,
          consumablesActualPaid: false,
        },
      ]),
    ]

    const resultat = versementsAFaire(elements)

    expect(resultat.destinataires).toHaveLength(2)
    expect(resultat.total).toBe(300_00)
  })

  it('📍 écarte un montant nul', () => {
    // Un virement de zéro ferait chercher une erreur qui n'existe pas.
    expect(versementsAFaire([element({ montant: 0 })]).total).toBe(0)
  })

  it('📍 trie par montant décroissant, dedans comme dehors', () => {
    const resultat = versementsAFaire([
      element({ cle: 'e1', montant: 70_00 }),
      element({ cle: 'e2', montant: 30_00 }),
      element({
        cle: 'e3',
        montant: 10_00,
        destinataire: { id: 'payee:2', label: 'Salle', iban: null, bic: null, origine: 'payee' },
      }),
    ])

    expect(resultat.destinataires[0]!.montant).toBe(100_00)
    expect(resultat.destinataires[0]!.lignes[0]!.montant).toBe(70_00)
    expect(resultat.destinataires[1]!.montant).toBe(10_00)
  })
})

describe('depensesAVerser', () => {
  const depense = (surcharges: Partial<DepenseARegler> = {}): DepenseARegler => ({
    id: 1,
    title: 'Location',
    montant: 100_00,
    code: null,
    payee: { id: 1, label: 'Chapiteaux du Sud', iban: IBAN_A, bic: 'BNPAFRPP' },
    ...surcharges,
  })

  it('traduit une dépense en élément à verser', () => {
    const [element] = depensesAVerser([depense()])

    expect(element!.destinataire.id).toBe('payee:1')
    expect(element!.destinataire.origine).toBe('payee')
    expect(element!.montant).toBe(100_00)
  })

  it('📍 écarte une dépense sans destinataire', () => {
    expect(depensesAVerser([depense({ payee: null })])).toHaveLength(0)
  })
})

describe('artistesAVerser', () => {
  const artiste = (surcharges: Partial<ArtisteAPayer> = {}): ArtisteAPayer => ({
    id: 5,
    nom: 'Cie des Balles',
    iban: IBAN_A,
    bic: 'BNPAFRPP',
    payment: 500_00,
    paymentPaid: false,
    reimbursementActual: 80_00,
    reimbursementActualPaid: false,
    consumablesActual: null,
    consumablesActualPaid: false,
    ...surcharges,
  })

  it('⚠️ produit UNE LIGNE PAR SOMME due, pas une seule par artiste', () => {
    /*
     * Cachet et défraiement sont deux sommes distinctes, chacune avec son drapeau. Les fondre
     * ferait disparaître l'une des deux dès que l'autre serait payée.
     */
    const elements = artistesAVerser([artiste()])

    expect(elements).toHaveLength(2)
    expect(elements.map((e) => e.montant).sort((a, b) => a - b)).toEqual([80_00, 500_00])
  })

  it('⚠️ écarte CHAQUE somme déjà payée, indépendamment des autres', () => {
    /*
     * Un artiste peut avoir touché son cachet mais pas son défraiement. Lier les deux ferait
     * réapparaître un montant déjà versé — ou disparaître un montant dû.
     */
    const elements = artistesAVerser([artiste({ paymentPaid: true })])

    expect(elements).toHaveLength(1)
    expect(elements[0]!.montant).toBe(80_00)
  })

  it('⚠️ N’INCLUT PAS un défraiement connu seulement par son PLAFOND', () => {
    /*
     * LE cas de ce lot. Un défraiement non justifié n'a pas de montant réel : `treasury-compute`
     * le compte comme engagé en notant qu'« on ne paie pas une somme qu'on ne connaît pas encore ».
     * Le virer reviendrait à payer un plafond, puis à réclamer la différence.
     */
    const elements = artistesAVerser([artiste({ payment: null, reimbursementActual: null })])

    expect(elements).toHaveLength(0)
  })

  it('📍 écarte un montant à zéro', () => {
    const elements = artistesAVerser([
      artiste({ payment: 0, reimbursementActual: 0, consumablesActual: 0 }),
    ])

    expect(elements).toHaveLength(0)
  })

  it('📍 nomme la somme dans le libellé, pour qu’un ordre de virement se lise seul', () => {
    const elements = artistesAVerser([artiste({ reimbursementActual: null })])

    expect(elements[0]!.libelle).toContain('Cachet')
    expect(elements[0]!.libelle).toContain('Cie des Balles')
  })
})
