import { describe, expect, it } from 'vitest'

import {
  couleurPastille,
  cumulerCompteurs,
  pastilleNavigation,
} from '../../../../../layers/ui/app/utils/pastille-navigation'

/**
 * Une pastille n'a d'intérêt que si elle veut dire quelque chose. Les deux façons de la vider de
 * son sens sont ici : en afficher une qui dit « 0 », et en mettre partout au même ton.
 */
describe('pastilleNavigation', () => {
  it('affiche le compte', () => {
    expect(pastilleNavigation(3)).toEqual({ texte: '3', ton: 'attention' })
  })

  it('ne rend rien à zéro', () => {
    // Une pastille « 0 » est une tache sans message : c'est l'absence de pastille qui dit
    // « rien à faire ».
    expect(pastilleNavigation(0)).toBeNull()
  })

  it('ne rend rien pour un compteur absent', () => {
    // Le cas d'une requête qui n'a pas encore répondu, ou qui a échoué.
    expect(pastilleNavigation(null)).toBeNull()
    expect(pastilleNavigation(undefined)).toBeNull()
  })

  it('ne rend rien pour une valeur aberrante', () => {
    // Un compteur qui casse la barre de navigation parce qu'un calcul a mal tourné serait un
    // remède pire que le mal.
    expect(pastilleNavigation(-4)).toBeNull()
    expect(pastilleNavigation(Number.NaN)).toBeNull()
    expect(pastilleNavigation(Number.POSITIVE_INFINITY)).toBeNull()
  })

  it('abrège au-delà du maximum', () => {
    expect(pastilleNavigation(100)?.texte).toBe('99+')
    expect(pastilleNavigation(1248)?.texte).toBe('99+')
  })

  it('affiche encore le maximum exact', () => {
    // La borne appartient au compte : « 99 » se lit, c'est à partir de 100 qu'on abrège.
    expect(pastilleNavigation(99)?.texte).toBe('99')
  })

  it('accepte un autre maximum', () => {
    expect(pastilleNavigation(15, { maximum: 9 })?.texte).toBe('9+')
  })

  it('passe au ton urgent au-delà du seuil', () => {
    // Sépare « il y a des choses à faire » de « il y en a trop » : sans seuil, le même ton sert
    // du premier au centième.
    expect(pastilleNavigation(2, { seuilUrgent: 5 })?.ton).toBe('attention')
    expect(pastilleNavigation(5, { seuilUrgent: 5 })?.ton).toBe('urgent')
    expect(pastilleNavigation(9, { seuilUrgent: 5 })?.ton).toBe('urgent')
  })

  it('garde le ton demandé sans seuil', () => {
    expect(pastilleNavigation(3, { ton: 'neutre' })?.ton).toBe('neutre')
  })

  it('tronque un compte décimal plutôt que de l’afficher', () => {
    // Personne n'a « 2,7 » choses en retard ; une moyenne qui arriverait ici doit se lire.
    expect(pastilleNavigation(2.7)?.texte).toBe('2')
    expect(pastilleNavigation(0.6)).toBeNull()
  })
})

describe('couleurPastille', () => {
  it('traduit chaque ton', () => {
    expect(couleurPastille('urgent')).toBe('error')
    expect(couleurPastille('attention')).toBe('warning')
    expect(couleurPastille('neutre')).toBe('neutral')
  })
})

/**
 * Une entrée repliée cache ses pastilles. Sans cumul, on n'apprend qu'en dépliant qu'il y avait
 * quelque chose à voir — ce qui vide la pastille de son intérêt, puisqu'elle sert justement à
 * éviter d'aller regarder.
 */
describe('cumulerCompteurs', () => {
  it('additionne les comptes des enfants', () => {
    expect(cumulerCompteurs([2, 1])).toBe(3)
  })

  it('ignore les enfants sans compte', () => {
    expect(cumulerCompteurs([2, null, undefined, 1])).toBe(3)
  })

  it('rend null quand aucun enfant n’a de compte', () => {
    // Et non zéro : un enfant qui n'a pas répondu ne compte pas pour zéro, il ne compte pas du
    // tout. Le parent n'affiche alors rien, comme ses enfants.
    expect(cumulerCompteurs([null, undefined])).toBeNull()
    expect(cumulerCompteurs([])).toBeNull()
  })

  it('rend zéro quand les enfants sont tous à zéro', () => {
    // Là, l'information existe : il n'y a rien à faire. `pastilleNavigation` n'affichera rien.
    expect(cumulerCompteurs([0, 0])).toBe(0)
  })

  it('ne se laisse pas fausser par une valeur aberrante', () => {
    expect(cumulerCompteurs([3, Number.NaN, -5, Number.POSITIVE_INFINITY])).toBe(3)
  })
})
