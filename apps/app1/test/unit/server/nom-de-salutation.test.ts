import { describe, it, expect } from 'vitest'

import { nomDeSalutation } from '../../../server/utils/nom-de-salutation'

/**
 * `User.prenom` est `String?` : 31 comptes sur 454 n'en ont pas, mesuré le 18/10/2026 en base.
 * Trois points d'API passaient la valeur brute à un courriel, et le défaut sortait différemment
 * selon le corps — `Bonjour ,` en HTML (Vue rend `null` comme une chaîne vide) et
 * `Bonjour null,` en texte (un gabarit littéral écrit le mot).
 */
describe('nomDeSalutation', () => {
  it('rend le prénom quand il existe', () => {
    expect(nomDeSalutation({ prenom: 'Jean', pseudo: 'jj' })).toBe('Jean')
  })

  it('se replie sur le pseudo quand le prénom est `null`', () => {
    // Le cas réel : 31 comptes sur 454.
    expect(nomDeSalutation({ prenom: null, pseudo: 'jongleur42' })).toBe('jongleur42')
  })

  it('se replie aussi quand le prénom est `undefined`', () => {
    expect(nomDeSalutation({ pseudo: 'jongleur42' })).toBe('jongleur42')
  })

  it('⚠️ se replie sur une chaîne VIDE, que `|| pseudo` rattrapait déjà', () => {
    expect(nomDeSalutation({ prenom: '', pseudo: 'jongleur42' })).toBe('jongleur42')
  })

  it('⚠️ et sur une chaîne BLANCHE, que `|| pseudo` ne rattrapait PAS', () => {
    /*
     * `'   ' || pseudo` rend `'   '`, qui est véridique : la salutation devenait « Bonjour    , ».
     * C'est la raison du `trim()` dans l'util, et ce cas est le seul à le prouver.
     */
    expect(nomDeSalutation({ prenom: '   ', pseudo: 'jongleur42' })).toBe('jongleur42')
  })

  it('élague les blancs autour d’un prénom par ailleurs valable', () => {
    expect(nomDeSalutation({ prenom: '  Jean  ', pseudo: 'jj' })).toBe('Jean')
  })

  it('ne rend JAMAIS une salutation vide, même sans prénom ni pseudo', () => {
    /*
     * Inatteignable avec un `User` de la base — `pseudo` y est `String @unique`. Le cas existe
     * pour l'appelant qui oublie de sélectionner `pseudo` : mieux vaut un mot générique qu'une
     * salutation amputée. C'est exactement ce que `prenom || ''` produisait.
     */
    for (const personne of [{}, { prenom: null, pseudo: null }, { prenom: '', pseudo: '  ' }]) {
      const rendu = nomDeSalutation(personne)
      expect(rendu.trim(), `salutation vide pour ${JSON.stringify(personne)}`).not.toBe('')
    }
  })

  it('📍 le témoin : aucune entrée ne produit « null » ni « undefined » en toutes lettres', () => {
    /*
     * Le pire des deux défauts d'origine : un gabarit littéral écrit `null` tel quel. Si l'util
     * rendait un jour la valeur sans la filtrer, c'est ce cas qui crierait.
     */
    for (const personne of [
      { prenom: null, pseudo: 'jj' },
      { prenom: undefined, pseudo: 'jj' },
      { prenom: null, pseudo: null },
      {},
    ]) {
      const rendu = nomDeSalutation(personne)
      expect(rendu, `« ${rendu} » pour ${JSON.stringify(personne)}`).not.toMatch(/null|undefined/i)
    }
  })
})
