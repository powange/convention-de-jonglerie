import { describe, expect, it } from 'vitest'

import { dateDuReglement, reglementNormalise } from '../../../server/utils/treasury-guards'

/**
 * Le « à régler » d'une dépense : à qui l'on doit verser, et si c'est fait.
 *
 * ## ⚠️ L'INVARIANT QUE CES CAS GARDENT
 *
 * Une dépense est soit **avancée** par quelqu'un — l'association lui doit de l'argent —, soit **à
 * régler** à un tiers — l'association doit de l'argent à ce tiers. **Jamais les deux.**
 *
 * Si les deux cohabitaient, la ligne compterait dans le total « à rembourser » ET dans le total
 * « à régler » : le même montant serait réclamé deux fois, et rien ne le signalerait. Les deux
 * totaux seraient justes pris séparément, et faux additionnés.
 *
 * ## Et ce qui est au contraire CUMULABLE
 *
 * `isForecast` et « à régler » ne se recouvrent pas : l'un dit si l'argent est sorti, l'autre à qui
 * il doit aller. Un devis signé non encore viré est les deux à la fois, et c'est le cas le plus
 * courant de la fonctionnalité.
 */
const SANS_AVANCE = { advancedById: null, advancedByName: null }

describe('reglementNormalise', () => {
  it('retient le bénéficiaire sur une dépense sans avance', () => {
    expect(reglementNormalise({ kind: 'EXPENSE', payeeId: 7, avanceRetenue: SANS_AVANCE })).toEqual(
      { payeeId: 7, disbursed: false }
    )
  })

  it('⚠️ EFFACE le bénéficiaire quand la dépense est avancée par un COMPTE', () => {
    /*
     * LE cas. L'avance l'emporte : elle constate un fait accompli — quelqu'un a déjà sorti
     * l'argent —, là où le règlement décrit une obligation à venir. Entre un fait et une
     * intention, on garde le fait.
     */
    expect(
      reglementNormalise({
        kind: 'EXPENSE',
        payeeId: 7,
        avanceRetenue: { advancedById: 42, advancedByName: null },
      })
    ).toEqual({ payeeId: null, disbursed: false })
  })

  it('⚠️ EFFACE le bénéficiaire quand la dépense est avancée par un NOM LIBRE', () => {
    // Beaucoup de ceux qui avancent de l'argent n'ont pas de compte : le nom libre vaut avance.
    expect(
      reglementNormalise({
        kind: 'EXPENSE',
        payeeId: 7,
        avanceRetenue: { advancedById: null, advancedByName: 'Jean-Luc' },
      })
    ).toEqual({ payeeId: null, disbursed: false })
  })

  it('📍 efface le bénéficiaire sur une RECETTE', () => {
    /*
     * Une recette n'est versée à personne : c'est l'édition qui l'encaisse. Normalisé et non
     * refusé — un formulaire qui bascule de dépense à recette laisse traîner les champs qu'il
     * affichait, et rejeter la saisie pour cela serait incompréhensible.
     */
    expect(reglementNormalise({ kind: 'INCOME', payeeId: 7, avanceRetenue: SANS_AVANCE })).toEqual({
      payeeId: null,
      disbursed: false,
    })
  })

  it('⚠️ force `disbursed` à faux SANS bénéficiaire', () => {
    /*
     * Sans destinataire, il n'y a rien à régler. Un `true` qui traîne ferait compter la ligne
     * comme soldée dans un total auquel elle n'appartient pas — et la carte des versements
     * afficherait un montant restant trop bas, ce qui ne se remarque pas.
     */
    expect(
      reglementNormalise({
        kind: 'EXPENSE',
        payeeId: null,
        disbursed: true,
        avanceRetenue: SANS_AVANCE,
      })
    ).toEqual({ payeeId: null, disbursed: false })
  })

  it('garde `disbursed` à vrai AVEC un bénéficiaire', () => {
    expect(
      reglementNormalise({
        kind: 'EXPENSE',
        payeeId: 7,
        disbursed: true,
        avanceRetenue: SANS_AVANCE,
      })
    ).toEqual({ payeeId: 7, disbursed: true })
  })
})

describe('dateDuReglement', () => {
  it('pose la date au moment où l’on verse', () => {
    const resultat = dateDuReglement(false, true)
    expect(resultat.disbursedAt).toBeInstanceOf(Date)
  })

  it('efface la date quand on annule le versement', () => {
    expect(dateDuReglement(true, false)).toEqual({ disbursedAt: null })
  })

  it('⚠️ NE TOUCHE À RIEN quand c’était déjà réglé et que ça l’est toujours', () => {
    /*
     * Le cas qui compte, et le seul pour lequel la fonction a besoin de l'état d'avant.
     * Réenregistrer une ligne pour corriger son libellé ne doit pas déplacer la date du virement à
     * aujourd'hui : le chiffre serait faux et parfaitement plausible.
     *
     * L'objet VIDE est la réponse correcte — pas `{ disbursedAt: undefined }`, qui écraserait.
     */
    expect(dateDuReglement(true, true)).toEqual({})
  })

  it('📍 à la création, une ligne saisie « déjà réglée » est datée du jour', () => {
    // Pas d'état d'avant : il n'y a rien à préserver.
    expect(dateDuReglement(undefined, true).disbursedAt).toBeInstanceOf(Date)
  })

  it('📍 et une ligne créée non réglée n’a pas de date', () => {
    expect(dateDuReglement(undefined, false)).toEqual({ disbursedAt: null })
  })
})
