import { describe, expect, it } from 'vitest'

import { compterListesDeCoursesEnCours } from '../../../../../layers/stock/app/utils/compteur-listes-de-courses'

/**
 * La pastille des listes de courses.
 *
 * Deux distinctions portent ce fichier, et toutes deux se perdent facilement en refactorisant :
 * « on ne sait pas » (`null`, pas de pastille) n'est pas « rien à faire » (zéro) ; et une liste
 * VIDE n'attend rien de personne, alors qu'elle n'est pas « terminée » au sens de `listeTerminee`.
 */
const liste = (...achats: boolean[]) => ({ items: achats.map((purchased) => ({ purchased })) })
const reponse = (...listes: ReturnType<typeof liste>[]) => ({ data: { lists: listes } })

describe('compterListesDeCoursesEnCours', () => {
  it('compte une liste dont tout n’est pas coché', () => {
    expect(compterListesDeCoursesEnCours(reponse(liste(false, true)))).toBe(1)
  })

  it('ne compte pas une liste entièrement cochée', () => {
    // Sinon la pastille resterait allumée à jamais et cesserait de vouloir dire quelque chose.
    expect(compterListesDeCoursesEnCours(reponse(liste(true, true)))).toBe(0)
  })

  it('ne compte pas une liste vide', () => {
    // Elle ne promet aucun achat : elle n'attend rien de personne. C'est la divergence assumée
    // avec `listeTerminee`, qui répond « non » pour une liste vide.
    expect(compterListesDeCoursesEnCours(reponse({ items: [] }))).toBe(0)
  })

  it('additionne les listes en cours', () => {
    expect(
      compterListesDeCoursesEnCours(reponse(liste(false), liste(true), liste(true, false)))
    ).toBe(2)
  })

  it('rend zéro quand l’édition n’a aucune liste', () => {
    // Ici l'absence est une réponse : il n'y a rien à racheter.
    expect(compterListesDeCoursesEnCours(reponse())).toBe(0)
  })

  it('rend null quand la réponse est inexploitable', () => {
    // `null` veut dire « on ne sait pas » et n'affiche aucune pastille. Zéro affirmerait qu'il n'y
    // a rien à faire — ce qu'une réponse malformée ne permet pas de dire.
    expect(compterListesDeCoursesEnCours(null)).toBeNull()
    expect(compterListesDeCoursesEnCours(undefined)).toBeNull()
    expect(compterListesDeCoursesEnCours({})).toBeNull()
    expect(compterListesDeCoursesEnCours({ data: null })).toBeNull()
    expect(compterListesDeCoursesEnCours({ data: { lists: null } })).toBeNull()
  })

  it('traite un article sans état comme non acheté', () => {
    // Prudence volontaire : mieux vaut signaler une liste déjà finie que taire un achat à faire.
    expect(compterListesDeCoursesEnCours(reponse({ items: [{}] }))).toBe(1)
  })

  it('n’explose pas sur une liste malformée', () => {
    expect(
      compterListesDeCoursesEnCours({ data: { lists: [{ items: null }, liste(false)] } })
    ).toBe(1)
  })
})
