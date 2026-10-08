import { describe, expect, it } from 'vitest'

import { parseMontantSaisi } from '../../../shared/utils/money'

/**
 * L'analyse d'un montant tapé à la main.
 *
 * Cette fonction existe pour une raison mesurée : un champ `type="number"` **avale** la virgule et
 * déclare la saisie valide, et `UInputNumber` la lit comme un séparateur de milliers. « 12,50 »
 * devenait 1 250 € — cent fois trop, sans alerte, sur le séparateur décimal de tout francophone.
 */
describe('parseMontantSaisi', () => {
  it('rend null sur une saisie vide', () => {
    for (const vide of ['', '   ', null, undefined]) {
      expect(parseMontantSaisi(vide)).toBeNull()
    }
  })

  it('lit un entier', () => {
    expect(parseMontantSaisi('1234')).toBe(1234)
  })

  /* ⚠️ LES DEUX SÉPARATEURS, et c'est tout l'objet de la fonction. */
  it('accepte la virgule comme séparateur décimal', () => {
    expect(parseMontantSaisi('12,50')).toBe(12.5)
    expect(parseMontantSaisi('0,05')).toBe(0.05)
  })

  it('accepte le point comme séparateur décimal', () => {
    expect(parseMontantSaisi('12.50')).toBe(12.5)
    expect(parseMontantSaisi('0.05')).toBe(0.05)
  })

  // Le cas qui a motivé le lot : ces deux saisies doivent donner LE MÊME montant.
  it('lit la virgule et le point comme un seul et même montant', () => {
    expect(parseMontantSaisi('12,50')).toBe(parseMontantSaisi('12.50'))
    expect(parseMontantSaisi('1234,56')).toBe(parseMontantSaisi('1234.56'))
  })

  /*
   * Les espaces de groupement : celles que `Intl.NumberFormat` produit en français. Recopier un
   * montant affiché par l'application le ramène ici, insécables comprises — et `\s` ne couvre ni
   * U+00A0 ni U+202F en JavaScript.
   */
  it('retire les espaces de groupement, insécables comprises', () => {
    expect(parseMontantSaisi('1 234,56')).toBe(1234.56)
    expect(parseMontantSaisi('1 234,56')).toBe(1234.56)
    expect(parseMontantSaisi('1 234,56')).toBe(1234.56)
    expect(parseMontantSaisi("1'234,56")).toBe(1234.56)
  })

  it('tranche par le DERNIER séparateur quand les deux sont là', () => {
    // Forme française : le point groupe, la virgule décime.
    expect(parseMontantSaisi('1.234,56')).toBe(1234.56)
    // Forme anglaise : l'inverse, et le résultat doit être le même montant.
    expect(parseMontantSaisi('1,234.56')).toBe(1234.56)
    expect(parseMontantSaisi('1.234.567,89')).toBe(1234567.89)
  })

  it('traite un séparateur répété comme du groupement', () => {
    // Deux points ne peuvent pas être décimaux : c'est forcément du groupement.
    expect(parseMontantSaisi('1.234.567')).toBe(1234567)
    expect(parseMontantSaisi('1,234,567')).toBe(1234567)
  })

  /*
   * ⚠️ L'AMBIGUÏTÉ ASSUMÉE, et le sens dans lequel on la tranche.
   *
   * `1.000` peut vouloir dire mille. On lit `1,00` — délibérément — parce que les deux erreurs ne
   * se valent pas : lire mille quand on voulait un euro gonfle un compte de résultat en silence,
   * tandis que lire un euro quand on voulait mille saute aux yeux dès que le champ se reformate.
   */
  it('lit un séparateur unique comme décimal, même suivi de trois chiffres', () => {
    expect(parseMontantSaisi('1.000')).toBe(1)
    expect(parseMontantSaisi('1,000')).toBe(1)
    // Et surtout PAS mille : c'est l'erreur qui se verrait le moins.
    expect(parseMontantSaisi('1.000')).not.toBe(1000)
  })

  it('accepte un nombre déjà numérique, tel quel', () => {
    expect(parseMontantSaisi(12.5)).toBe(12.5)
    expect(parseMontantSaisi(0)).toBe(0)
    expect(parseMontantSaisi(Number.NaN)).toBeNull()
  })

  it('accepte un montant négatif', () => {
    expect(parseMontantSaisi('-12,50')).toBe(-12.5)
  })

  /*
   * Refuser plutôt que d'inventer : un champ vide se corrige, un montant deviné ne se remarque
   * pas. C'est la même raison qui fait reformater le champ en sortie de saisie.
   */
  it('refuse ce qui ne désigne aucun nombre', () => {
    for (const saisie of ['abc', '12€', '1,2,3.4.5', '-', ',', '.', '12-50']) {
      expect(parseMontantSaisi(saisie), `« ${saisie} » devrait être refusé`).toBeNull()
    }
  })

  it('tolère les formes partielles d’une saisie en cours', () => {
    // On tape « 12, » avant les centimes : la valeur vaut déjà 12, et non rien.
    expect(parseMontantSaisi('12,')).toBe(12)
    expect(parseMontantSaisi(',5')).toBe(0.5)
  })
})
