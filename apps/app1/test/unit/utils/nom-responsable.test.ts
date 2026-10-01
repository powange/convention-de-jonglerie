import { describe, expect, it } from 'vitest'

import {
  etatCivil,
  libelleResponsable,
} from '../../../../../layers/stock/app/utils/nom-responsable'

/**
 * Comment on nomme la personne qui s'occupe d'un matériel.
 *
 * ⚠️ LES ÉCRANS DU STOCK N'AFFICHAIENT QUE LE PSEUDO, et c'est la demande de l'utilisateur :
 * « difficile de différencier qui est qui quand on ne connaît pas tout le monde sur l'événement ».
 * Un pseudo ne ressemble pas forcément au nom de son porteur, et deux pseudos proches ne désignent
 * personne pour qui organise une tournée de récupération.
 *
 * ⚠️⚠️ ET LE LIBELLÉ ÉTAIT DÉJÀ ÉCRIT DEUX FOIS, différemment : la liste déroulante de recherche
 * composait `pseudo (Prénom Nom)`, les trois autres surfaces n'affichaient que le pseudo. On
 * CHERCHAIT donc quelqu'un sous un nom qui ne s'affichait ensuite nulle part. Une seule fonction
 * désormais, et ces tests la tiennent.
 */

describe('etatCivil', () => {
  it('assemble le prénom puis le nom', () => {
    expect(etatCivil({ pseudo: 'jo', prenom: 'Jean', nom: 'Dupont' })).toBe('Jean Dupont')
  })

  it('se contente de ce qui est renseigné', () => {
    // Les deux champs sont FACULTATIFS sur un compte : beaucoup n'en ont qu'un, ou aucun.
    expect(etatCivil({ pseudo: 'jo', prenom: 'Jean' })).toBe('Jean')
    expect(etatCivil({ pseudo: 'jo', nom: 'Dupont' })).toBe('Dupont')
    expect(etatCivil({ pseudo: 'jo' })).toBe('')
  })

  it('ignore les chaînes vides plutôt que de laisser un espace', () => {
    // Un champ vidé par l'utilisateur est une chaîne vide, pas `null` : sans le filtre, le libellé
    // porterait une parenthèse contenant un seul espace.
    expect(etatCivil({ pseudo: 'jo', prenom: '', nom: 'Dupont' })).toBe('Dupont')
    expect(etatCivil({ pseudo: 'jo', prenom: '', nom: '' })).toBe('')
  })

  it('ne rend rien sans personne', () => {
    expect(etatCivil(null)).toBe('')
    expect(etatCivil(undefined)).toBe('')
  })
})

describe('libelleResponsable', () => {
  it('🔬 rend le pseudo ET l’état civil', () => {
    // L'assertion qui porte la demande : c'est ce que les écrans affichaient sans le nom.
    expect(libelleResponsable({ pseudo: 'jo', prenom: 'Jean', nom: 'Dupont' })).toBe(
      'jo (Jean Dupont)'
    )
  })

  it('🔬 retombe sur le pseudo SEUL quand il n’y a pas d’état civil', () => {
    /*
     * ⚠️ Le cas qui interdit de faire du nom le libellé principal : prénom et nom sont facultatifs,
     * et beaucoup de comptes n'en ont pas. Mettre le nom devant donnerait une colonne à moitié
     * vide ; et une parenthèse vide derrière le pseudo serait du bruit.
     */
    expect(libelleResponsable({ pseudo: 'jo' })).toBe('jo')
    expect(libelleResponsable({ pseudo: 'jo', prenom: null, nom: null })).toBe('jo')
    expect(libelleResponsable({ pseudo: 'jo', prenom: '', nom: '' })).toBe('jo')
  })

  it('garde le PSEUDO en tête', () => {
    /*
     * 📍 Ce n'est pas arbitraire : c'est le pseudo qu'on a cherché, lui qui figure dans la liste
     * déroulante, et lui qui est toujours renseigné. Un libellé qui commencerait par le nom
     * obligerait à relire pour retrouver la personne qu'on vient de choisir.
     */
    expect(libelleResponsable({ pseudo: 'jo', prenom: 'Jean', nom: 'Dupont' })).toMatch(/^jo /)
  })

  it('ne rend rien sans compte, ni sans pseudo', () => {
    // Un responsable peut n'être qu'un texte libre — quelqu'un sans compte sur le site. L'appelant
    // retombe alors sur ce texte, encore faut-il que cette fonction ne rende rien d'utilisable.
    expect(libelleResponsable(null)).toBe('')
    expect(libelleResponsable(undefined)).toBe('')
    expect(libelleResponsable({ pseudo: '' })).toBe('')
  })
})
