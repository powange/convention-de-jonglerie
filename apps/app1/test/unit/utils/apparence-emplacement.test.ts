import { describe, expect, it } from 'vitest'

import {
  apparenceEmplacement,
  libelleEmplacement,
} from '../../../../../layers/stock/app/utils/apparence-emplacement'

/**
 * Un emplacement se dit de deux façons complémentaires : un lieu de la carte du site, et une
 * précision écrite à la main. « Zone technique » situe, « troisième étagère à gauche » retrouve.
 * Faire primer l'un sur l'autre cachait une information saisie exprès.
 *
 * Les lieux de la carte portent en outre la couleur et l'icône de leur type : rien ne distinguait
 * auparavant une scène d'un point d'eau.
 */
const ZONE = { name: 'Zone technique', color: '#ff0000', zoneTypes: ['SHOWS'] }
const MARQUEUR = { name: 'Toilettes', markerTypes: ['TOILETS'] }

describe('apparenceEmplacement', () => {
  it('reprend la couleur et le type d’une zone', () => {
    const emplacement = apparenceEmplacement(ZONE, null)

    expect(emplacement?.carte?.nom).toBe('Zone technique')
    expect(emplacement?.carte?.couleur).toBe('#ff0000')
    expect(emplacement?.texte).toBeNull()
  })

  it('garde le lieu ET la précision écrite à la main', () => {
    // C'est tout l'objet : « Zone technique » situe, « troisième étagère » retrouve.
    const emplacement = apparenceEmplacement(ZONE, null, 'Troisième étagère à gauche')

    expect(emplacement?.carte?.nom).toBe('Zone technique')
    expect(emplacement?.texte).toBe('Troisième étagère à gauche')
  })

  it('vaut aussi pour un marqueur accompagné d’un texte', () => {
    const emplacement = apparenceEmplacement(null, MARQUEUR, 'Derrière la porte')

    expect(emplacement?.carte?.nom).toBe('Toilettes')
    expect(emplacement?.texte).toBe('Derrière la porte')
  })

  it('retombe sur la couleur du type quand le marqueur n’en a pas', () => {
    // C'est la règle du sélecteur d'emplacement : `color` nulle veut dire « celle du type ».
    const emplacement = apparenceEmplacement(null, MARQUEUR)

    expect(emplacement?.carte?.couleur).toBeTruthy()
  })

  it('distingue deux types par leur icône', () => {
    const spectacles = apparenceEmplacement({ ...ZONE, zoneTypes: ['SHOWS'] }, null)
    const bar = apparenceEmplacement({ ...ZONE, zoneTypes: ['BAR'] }, null)

    expect(spectacles?.carte?.icone).not.toBe(bar?.carte?.icone)
  })

  it('tolère un type absent ou mal formé', () => {
    expect(apparenceEmplacement({ name: 'A', color: '#fff' }, null)?.carte?.icone).toBeTruthy()
    expect(
      apparenceEmplacement({ name: 'A', color: '#fff', zoneTypes: 'x' }, null)?.carte?.icone
    ).toBeTruthy()
    expect(
      apparenceEmplacement({ name: 'A', color: '#fff', zoneTypes: [] }, null)?.carte?.icone
    ).toBeTruthy()
  })

  it('fait primer la zone sur le marqueur', () => {
    // Un matériel n'est posé qu'à un endroit de la carte ; le texte, lui, s'ajoute.
    const emplacement = apparenceEmplacement(ZONE, MARQUEUR, 'Étagère')

    expect(emplacement?.carte?.nom).toBe('Zone technique')
    expect(emplacement?.texte).toBe('Étagère')
  })

  it('accepte un texte libre seul', () => {
    const emplacement = apparenceEmplacement(null, null, 'Tente technique B')

    expect(emplacement).toEqual({ carte: null, texte: 'Tente technique B' })
  })

  it('ne rend rien sans emplacement', () => {
    expect(apparenceEmplacement(null, null)).toBeNull()
    expect(apparenceEmplacement(null, null, '   ')).toBeNull()
  })
})

describe('libelleEmplacement', () => {
  it('trie sur le lieu de la carte quand il y en a un', () => {
    // Trier sur la précision écrite à la main disperserait les matériels rangés au même endroit.
    const emplacement = apparenceEmplacement(ZONE, null, 'Troisième étagère')

    expect(libelleEmplacement(emplacement)).toBe('Zone technique')
  })

  it('retombe sur le texte libre à défaut', () => {
    expect(libelleEmplacement(apparenceEmplacement(null, null, 'Tente B'))).toBe('Tente B')
  })

  it('rend une chaîne vide sans emplacement', () => {
    expect(libelleEmplacement(null)).toBe('')
  })
})
