import { describe, expect, it } from 'vitest'

import {
  aUneRemise,
  montantBrutDeLaLigne,
  montantNetDeLaLigne,
  remiseDeLaLigne,
} from '../../../shared/utils/remise-de-ligne'

/**
 * La remise accordée sur une ligne de commande.
 *
 * ⚠️ POURQUOI CES TESTS. On est sur de l'argent, et une erreur y est silencieuse : un encaissé
 * faux s'affiche aussi bien qu'un encaissé juste. Rien dans l'application ne dira que le total
 * a dérivé du montant rendu — on s'en aperçoit au bilan, des semaines plus tard.
 */

const ligne = (amount: number, options: number[] = [], discountAmount = 0) => ({
  amount,
  selectedOptions: options.map((a) => ({ amount: a })),
  discountAmount,
})

describe('le prix brut', () => {
  it('additionne le tarif et ses options', () => {
    // Une inscription porte souvent des options payantes — repas, hébergement, tee-shirt — et
    // c'est la somme qui est due. Une remise se compare à ce total, pas au seul tarif.
    expect(montantBrutDeLaLigne(ligne(2000, [500, 300]))).toBe(2800)
  })

  it('tient debout sur une ligne incomplète', () => {
    // Une ligne dont le prix n'est pas encore connu doit se lire, pas casser l'écran.
    expect(montantBrutDeLaLigne(null)).toBe(0)
    expect(montantBrutDeLaLigne({})).toBe(0)
    expect(montantBrutDeLaLigne({ amount: 1000, selectedOptions: null })).toBe(1000)
  })
})

describe('la remise', () => {
  it('se soustrait du prix', () => {
    expect(montantNetDeLaLigne(ligne(2000, [500], 700))).toBe(1800)
  })

  it('absente ou nulle, elle ne retire rien', () => {
    expect(montantNetDeLaLigne(ligne(2000))).toBe(2000)
    expect(montantNetDeLaLigne({ amount: 2000 })).toBe(2000)
    expect(aUneRemise(ligne(2000))).toBe(false)
  })

  it('⚠️ PLAFONNÉE AU PRIX : jamais de net négatif', () => {
    /*
     * Une remise supérieure au prix ferait *gagner* de l'argent à l'encaissé — un total qui monte
     * quand on rend de l'argent est le genre d'erreur qu'on ne cherche pas là où elle est.
     *
     * Le cas n'est pas théorique : une option retirée d'un billet après coup fait baisser le prix,
     * et peut le faire passer sous une remise accordée la veille.
     */
    expect(montantNetDeLaLigne(ligne(2000, [], 5000))).toBe(0)
    expect(remiseDeLaLigne(ligne(2000, [], 5000))).toBe(2000)
  })

  it('⚠️ une remise NÉGATIVE ne majore pas le prix', () => {
    // Une saisie fautive ou une donnée abîmée ne doit pas se lire comme un supplément : on
    // encaisserait plus que ce que la personne a payé.
    expect(montantNetDeLaLigne(ligne(2000, [], -500))).toBe(2000)
    expect(remiseDeLaLigne(ligne(2000, [], -500))).toBe(0)
    expect(aUneRemise(ligne(2000, [], -500))).toBe(false)
  })

  it('exactement le prix : net à zéro, et c’est une remise', () => {
    // La gratuité accordée après coup. Elle n'annule PAS le billet : la personne entre toujours.
    expect(montantNetDeLaLigne(ligne(2000, [], 2000))).toBe(0)
    expect(aUneRemise(ligne(2000, [], 2000))).toBe(true)
  })

  it('porte sur le prix OPTIONS COMPRISES', () => {
    /*
     * Plafonner sur le seul tarif retirerait à tort une partie d'une remise légitime : un billet
     * à 20 € avec 30 € d'options peut faire l'objet d'une remise de 25 €.
     */
    expect(remiseDeLaLigne(ligne(2000, [3000], 2500))).toBe(2500)
    expect(montantNetDeLaLigne(ligne(2000, [3000], 2500))).toBe(2500)
  })
})
