import { describe, expect, it } from 'vitest'

import {
  correspondAuxEtats,
  estAvancee,
  estPrevisionnelle,
  ETATS_DE_TRESORERIE,
} from '../../../app/utils/etats-de-tresorerie'

/**
 * Le filtre par état d'une ligne de trésorerie.
 *
 * ⚠️ POURQUOI CES TESTS. Un filtre se trompe en SILENCE : il rend une liste plus courte, et rien
 * ne dit que ce qui manque manque à tort. Chaque cas ci-dessous est une façon de perdre des lignes
 * sans s'en apercevoir.
 */
describe('reconnaître une ligne avancée', () => {
  it('sur un compte', () => {
    expect(estAvancee({ advancedBy: { id: 7 } })).toBe(true)
  })

  it('ET sur un NOM saisi librement', () => {
    /*
     * ⚠️ LE PIÈGE PRINCIPAL. L'avance se porte soit sur un compte, soit sur un nom libre — pour
     * les gens qui ne sont pas inscrits, nombreux sur une convention. Ne lire que `advancedBy`
     * perdrait toutes les avances de la seconde sorte, et le filtre paraîtrait simplement
     * « peu fourni ».
     */
    expect(estAvancee({ advancedByName: 'Jean-Luc' })).toBe(true)
  })

  it('ni l’un ni l’autre : pas une avance', () => {
    expect(estAvancee({})).toBe(false)
    expect(estAvancee({ advancedBy: null, advancedByName: null })).toBe(false)
    // Une chaîne vide n'est pas un nom : le serveur peut la laisser passer, le filtre non.
    expect(estAvancee({ advancedByName: '' })).toBe(false)
  })
})

describe('reconnaître une ligne prévisionnelle', () => {
  it('seulement quand le drapeau est vrai', () => {
    expect(estPrevisionnelle({ isForecast: true })).toBe(true)
    expect(estPrevisionnelle({ isForecast: false })).toBe(false)
    // Absent sur les lignes calculées : `undefined` ne doit pas se lire comme vrai.
    expect(estPrevisionnelle({})).toBe(false)
  })
})

describe('le filtre d’états', () => {
  const avancee = { advancedByName: 'Jean-Luc' }
  const previsionnelle = { isForecast: true }
  const ordinaire = {}
  const lesDeux = { isForecast: true, advancedBy: { id: 3 } }

  it('ne retire RIEN quand aucun état n’est retenu', () => {
    // Un filtre qu'on n'a pas posé ne doit pas filtrer — même règle que le filtre des codes.
    for (const ligne of [avancee, previsionnelle, ordinaire, lesDeux]) {
      expect(correspondAuxEtats(ligne, [])).toBe(true)
    }
  })

  it('retient les avancées seules', () => {
    expect(correspondAuxEtats(avancee, ['avancee'])).toBe(true)
    expect(correspondAuxEtats(previsionnelle, ['avancee'])).toBe(false)
    expect(correspondAuxEtats(ordinaire, ['avancee'])).toBe(false)
  })

  it('retient les prévisionnelles seules', () => {
    expect(correspondAuxEtats(previsionnelle, ['previsionnelle'])).toBe(true)
    expect(correspondAuxEtats(avancee, ['previsionnelle'])).toBe(false)
  })

  it('combine en OU, et non en ET', () => {
    /*
     * Retenir les deux états montre tout ce qui réclame une suite — la question qu'on se pose.
     * En ET, on n'obtiendrait que les lignes à la fois avancées ET prévisionnelles : un cas rare
     * dont on ne voit pas l'usage, et la liste paraîtrait vide sans qu'on comprenne pourquoi.
     */
    const etats = ['avancee', 'previsionnelle']
    expect(correspondAuxEtats(avancee, etats)).toBe(true)
    expect(correspondAuxEtats(previsionnelle, etats)).toBe(true)
    expect(correspondAuxEtats(lesDeux, etats)).toBe(true)
    expect(correspondAuxEtats(ordinaire, etats)).toBe(false)
  })

  it('un état INCONNU ne retient rien', () => {
    /*
     * Une URL bricolée, ou un état retiré d'une version à l'autre. Ne rien retenir est le choix
     * prudent : le lire comme « pas de filtre » afficherait toute la trésorerie alors que le
     * sélecteur montre une sélection — l'écran mentirait sur ce qu'il affiche.
     */
    expect(correspondAuxEtats(avancee, ['nimportequoi'])).toBe(false)
    // Mais un état connu présent à côté suffit à retenir.
    expect(correspondAuxEtats(avancee, ['nimportequoi', 'avancee'])).toBe(true)
  })

  it('les deux états annoncés sont bien ceux que le filtre sait traiter', () => {
    // Garde contre un ajout dans la liste sans ajout dans le filtre : l'état apparaîtrait dans le
    // sélecteur et ne retiendrait jamais rien.
    for (const etat of ETATS_DE_TRESORERIE) {
      const quelqueChose = [avancee, previsionnelle].some((l) => correspondAuxEtats(l, [etat]))
      expect(quelqueChose, `l'état « ${etat} » ne retient aucune ligne`).toBe(true)
    }
  })
})
