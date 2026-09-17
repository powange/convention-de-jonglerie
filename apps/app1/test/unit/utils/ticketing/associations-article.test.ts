import { describe, it, expect } from 'vitest'

import {
  enumererLesAssociations,
  type AssociationsDunArticle,
} from '../../../../../../layers/ticketing/app/utils/ticketing/associations-article'

/**
 * Traducteur de test, volontairement sans pluriel : « <catégorie>=<n> ».
 *
 * Une fausse pluralisation ferait porter les assertions sur elle plutôt que sur l'énumération,
 * et la première version de ce test s'y est prise les pieds — « tarifs » y devenait « tarifss ».
 */
const t = (cle: string, count: number) => `${cle.split('.').pop()}=${count}`

const aucune: AssociationsDunArticle = {
  tarifs: 0,
  options: 0,
  champsPersonnalises: 0,
  spectacles: 0,
  artistes: 0,
  equipesBenevoles: 0,
  organisateurs: 0,
  repas: 0,
}

const avec = (partiel: Partial<AssociationsDunArticle>): AssociationsDunArticle => ({
  ...aucune,
  ...partiel,
})

describe('enumererLesAssociations', () => {
  it('rend une chaîne vide quand l’article n’est associé à rien', () => {
    expect(enumererLesAssociations(aucune, t, 'et')).toBe('')
  })

  it('rend une chaîne vide quand le décompte est absent', () => {
    // La liste peut être affichée avant que le point d'API n'ait renvoyé les décomptes.
    expect(enumererLesAssociations(undefined, t, 'et')).toBe('')
    expect(enumererLesAssociations(null, t, 'et')).toBe('')
  })

  it('rend un seul terme sans coordination', () => {
    expect(enumererLesAssociations(avec({ tarifs: 3 }), t, 'et')).toBe('tarifs=3')
  })

  it('coordonne le dernier terme et sépare les autres par des virgules', () => {
    const phrase = enumererLesAssociations(
      avec({ tarifs: 3, options: 1, equipesBenevoles: 2 }),
      t,
      'et'
    )

    expect(phrase).toBe('tarifs=3, options=1 et equipesBenevoles=2')
  })

  /*
   * Les catégories vides sont écartées : « 3 tarifs, 0 option et 0 spectacle » se lit plus mal
   * que le seul chiffre qui compte, et la confirmation doit tenir en un coup d'œil.
   */
  it('écarte les catégories à zéro', () => {
    expect(enumererLesAssociations(avec({ tarifs: 3, options: 0 }), t, 'et')).toBe('tarifs=3')
  })

  /*
   * L'ordre est celui de CATEGORIES_ASSOCIATION, pas celui des clés de l'objet reçu : une liste
   * qui suivrait la sérialisation JSON changerait d'un appel à l'autre.
   */
  it('suit un ordre fixe, indépendant de celui des clés reçues', () => {
    const desordonne = {
      repas: 1,
      tarifs: 2,
      organisateurs: 1,
      options: 0,
      champsPersonnalises: 0,
      spectacles: 0,
      artistes: 0,
      equipesBenevoles: 0,
    } as AssociationsDunArticle

    expect(enumererLesAssociations(desordonne, t, 'et')).toBe(
      'tarifs=2, organisateurs=1 et repas=1'
    )
  })

  it('emploie la coordination qu’on lui donne', () => {
    expect(enumererLesAssociations(avec({ tarifs: 1, repas: 1 }), t, 'and')).toBe(
      'tarifs=1 and repas=1'
    )
  })
})
