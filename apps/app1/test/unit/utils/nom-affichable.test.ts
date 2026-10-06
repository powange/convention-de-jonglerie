import { describe, expect, it } from 'vitest'

import { nomAffichableDUnCompte, nomCompletDUnCompte } from '../../../shared/utils/nom-affichable'

/**
 * Comment nommer quelqu'un à l'écran.
 *
 * ⚠️ POURQUOI CES TESTS. La règle existe en dix-sept exemplaires dans le dépôt, sous trois formes
 * au moins : certaines retombent sur le prénom seul, d'autres sur l'adresse e-mail. Deux écrans
 * voisins nomment donc la même personne différemment, et personne ne s'en aperçoit tant qu'on ne
 * les met pas côte à côte.
 */
describe('le nom affichable', () => {
  it('préfère le pseudo', () => {
    // C'est sous ce nom qu'on se reconnaît ici : les bénévoles s'appellent entre eux par leur
    // pseudo, pas par leur état civil.
    expect(nomAffichableDUnCompte({ pseudo: 'Jongleur42', prenom: 'Jean', nom: 'Dupont' })).toBe(
      'Jongleur42'
    )
  })

  it('retombe sur l’état civil, puis sur l’adresse', () => {
    expect(nomAffichableDUnCompte({ prenom: 'Jean', nom: 'Dupont' })).toBe('Jean Dupont')
    expect(nomAffichableDUnCompte({ nom: 'Dupont' })).toBe('Dupont')
    expect(nomAffichableDUnCompte({ email: 'jean@example.com' })).toBe('jean@example.com')
  })

  it('⚠️ ne rend JAMAIS « null » ni « undefined »', () => {
    // L'appelant l'insère dans un gabarit : une valeur nulle s'afficherait telle quelle, et c'est
    // le genre de chose qu'on voit en production avant de la voir en test.
    expect(nomAffichableDUnCompte(null)).toBe('')
    expect(nomAffichableDUnCompte({})).toBe('')
    expect(nomAffichableDUnCompte({ pseudo: null, prenom: null, nom: null, email: null })).toBe('')
  })

  it('ignore les blancs, qui ne sont pas un nom', () => {
    // Un pseudo réduit à des espaces laisserait une étiquette vide, et l'on chercherait pourquoi.
    expect(nomAffichableDUnCompte({ pseudo: '   ', prenom: 'Jean' })).toBe('Jean')
  })
})

describe('le nom complet', () => {
  it('donne les deux quand les deux existent', () => {
    // Pour choisir quelqu'un dans une liste : le pseudo seul ne tranche pas entre deux homonymes.
    expect(nomCompletDUnCompte({ pseudo: 'Jongleur42', prenom: 'Jean', nom: 'Dupont' })).toBe(
      'Jongleur42 · Jean Dupont'
    )
  })

  it('se contente de ce qu’il a', () => {
    expect(nomCompletDUnCompte({ pseudo: 'Jongleur42' })).toBe('Jongleur42')
    expect(nomCompletDUnCompte({ prenom: 'Jean', nom: 'Dupont' })).toBe('Jean Dupont')
    expect(nomCompletDUnCompte({ email: 'jean@example.com' })).toBe('jean@example.com')
    expect(nomCompletDUnCompte(null)).toBe('')
  })
})
