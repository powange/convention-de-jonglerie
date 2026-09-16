import { describe, expect, it } from 'vitest'

import {
  AUCUNE_SELECTION,
  entierDepuisUrl,
  entiersDepuisUrl,
  listeDepuisUrl,
  requeteAvec,
  selectionDepuisUrl,
  selectionVersUrl,
  texteDepuisUrl,
  triDepuisUrl,
  triVersUrl,
  valeurDepuisUrl,
} from '../../../shared/utils/filtres-url'

/**
 * Les briques communes à tous les filtres d'URL.
 *
 * Elles étaient recopiées d'un écran à l'autre et avaient commencé à diverger. Les éprouver ici
 * une fois vaut mieux que de les re-tester dans chaque utilitaire d'écran — et surtout mieux que
 * de ne les tester nulle part, ce qui était le cas de la moitié des copies.
 */
describe('texteDepuisUrl', () => {
  it('rend le texte, espaces compris', () => {
    // La recherche est recopiée telle quelle : c'est ce que la personne a tapé, et la rogner ici
    // ferait diverger l'URL de ce que montre le champ.
    expect(texteDepuisUrl(' marie ')).toBe(' marie ')
  })

  it('rend la chaîne vide pour tout ce qui n’est pas une chaîne', () => {
    expect(texteDepuisUrl(undefined)).toBe('')
    expect(texteDepuisUrl(['a', 'b'])).toBe('')
    expect(texteDepuisUrl(null)).toBe('')
  })
})

describe('listeDepuisUrl', () => {
  it('découpe sur les virgules', () => {
    expect(listeDepuisUrl('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('ignore les fragments vides d’une virgule en trop', () => {
    expect(listeDepuisUrl('a,,b,')).toEqual(['a', 'b'])
  })

  it('rend une liste vide sur une URL nue', () => {
    expect(listeDepuisUrl(undefined)).toEqual([])
    expect(listeDepuisUrl('')).toEqual([])
  })
})

describe('entiersDepuisUrl', () => {
  it('rend des nombres, pas des chaînes', () => {
    expect(entiersDepuisUrl('3,17')).toEqual([3, 17])
  })

  it('ÉCARTE un fragment qui n’est pas un entier', () => {
    // Un identifiant tronqué dans une URL recopiée à la main ne doit pas partir en NaN dans une
    // requête — le serveur en ferait ce qu'il peut, c'est-à-dire n'importe quoi.
    expect(entiersDepuisUrl('3,abc,7,1.5')).toEqual([3, 7])
  })
})

describe('entierDepuisUrl', () => {
  it('lit un entier positif', () => {
    expect(entierDepuisUrl('4', 1)).toBe(4)
  })

  it('retombe sur le défaut pour tout ce qui n’en est pas un', () => {
    // Zéro et le négatif compris : une page 0 n'existe pas, et une granularité négative non plus.
    expect(entierDepuisUrl('0', 1)).toBe(1)
    expect(entierDepuisUrl('-2', 1)).toBe(1)
    expect(entierDepuisUrl('deux', 1)).toBe(1)
    expect(entierDepuisUrl(undefined, 1)).toBe(1)
    expect(entierDepuisUrl('', 1)).toBe(1)
  })
})

describe('valeurDepuisUrl', () => {
  const admises = ['SETUP', 'EVENT', 'TEARDOWN'] as const

  it('retient une valeur reconnue', () => {
    expect(valeurDepuisUrl('EVENT', admises, 'SETUP')).toBe('EVENT')
  })

  it('REFUSE une valeur inconnue', () => {
    // C'est la garde contre l'écran vide sans cause visible : une URL vieillie porte une valeur
    // que plus personne ne reconnaît, et la retenir filtrerait sur rien.
    expect(valeurDepuisUrl('MONTAGE', admises, 'SETUP')).toBe('SETUP')
    expect(valeurDepuisUrl(undefined, admises, 'SETUP')).toBe('SETUP')
  })
})

/**
 * Les sélections multiples dont le défaut est « tout coché ».
 *
 * Elles ont trois états, pas deux — et c'est le troisième, la sélection vide, qui se perd si on
 * n'y prend pas garde.
 */
describe('sélection multiple', () => {
  const defaut = ['participants', 'volunteers', 'artists']

  it('n’écrit rien quand la sélection est au défaut', () => {
    expect(selectionVersUrl(defaut, defaut)).toBe('')
  })

  it('ignore l’ordre pour juger du défaut', () => {
    // Décocher puis recocher une case change l'ordre sans changer la sélection : l'URL ne doit
    // pas se mettre à porter un réglage pour autant.
    expect(selectionVersUrl(['artists', 'participants', 'volunteers'], defaut)).toBe('')
  })

  it('écrit un sous-ensemble', () => {
    expect(selectionVersUrl(['volunteers'], defaut)).toBe('volunteers')
  })

  it('distingue la sélection VIDE du défaut', () => {
    // Sans marqueur, décocher toutes les cases s'écrirait comme une clé absente — donc comme le
    // défaut —, et serait le seul réglage que l'URL ne saurait pas retenir.
    const porte = selectionVersUrl([], defaut)

    expect(porte).toBe(AUCUNE_SELECTION)
    expect(selectionDepuisUrl(porte, defaut)).toEqual([])
  })

  it('rend le défaut sur une URL nue', () => {
    expect(selectionDepuisUrl(undefined, defaut)).toEqual(defaut)
    expect(selectionDepuisUrl('', defaut)).toEqual(defaut)
  })

  it('ne rend pas le tableau du défaut lui-même', () => {
    // Le rendre tel quel laisserait l'écran muter la constante en cochant une case.
    const rendu = selectionDepuisUrl(undefined, defaut)

    expect(rendu).not.toBe(defaut)
  })

  it('fait l’aller-retour sur un sous-ensemble', () => {
    expect(selectionDepuisUrl(selectionVersUrl(['artists', 'volunteers'], defaut), defaut)).toEqual(
      ['artists', 'volunteers']
    )
  })
})

describe('tri dans l’URL', () => {
  it('lit un tri croissant et un tri décroissant', () => {
    expect(triDepuisUrl('nom')).toEqual([{ id: 'nom', desc: false }])
    expect(triDepuisUrl('-createdAt')).toEqual([{ id: 'createdAt', desc: true }])
  })

  it('fait l’aller-retour sans rien perdre', () => {
    const tri = [
      { id: 'nom', desc: false },
      { id: 'createdAt', desc: true },
    ]

    expect(triDepuisUrl(triVersUrl(tri))).toEqual(tri)
  })

  it('rend la chaîne vide pour un tri absent', () => {
    expect(triVersUrl([])).toBe('')
    expect(triDepuisUrl(undefined)).toEqual([])
  })
})

/**
 * La réécriture de la query.
 *
 * Deux propriétés portent toute l'utilité de la fonction : ce qui est au défaut disparaît de
 * l'URL, et ce qu'on ne gère pas y reste.
 */
describe('requeteAvec', () => {
  it('écrit les valeurs non vides', () => {
    expect(requeteAvec({}, { status: 'ACCEPTED', search: 'marie' })).toEqual({
      status: 'ACCEPTED',
      search: 'marie',
    })
  })

  it('RETIRE de l’URL une valeur revenue à son défaut', () => {
    // Sans ça, l'URL grossit d'un réglage à chaque clic et finit illisible.
    expect(requeteAvec({ status: 'ACCEPTED' }, { status: '' })).toEqual({})
  })

  it('PRÉSERVE les paramètres qu’on ne gère pas', () => {
    // Un filtre d'équipe n'a aucune raison d'effacer l'onglet actif, posé là par un autre bout
    // de l'écran.
    expect(
      requeteAvec({ onglet: 'a_recuperer', status: 'PENDING' }, { status: 'ACCEPTED' })
    ).toEqual({ onglet: 'a_recuperer', status: 'ACCEPTED' })
  })

  it('préserve aussi un paramètre étranger répété', () => {
    expect(requeteAvec({ tag: ['a', 'b'] }, { search: 'x' })).toEqual({
      tag: ['a', 'b'],
      search: 'x',
    })
  })

  it('n’altère pas la query qu’on lui passe', () => {
    // Elle vient de `route.query`, que Vue Router expose en lecture : la muter est une faute
    // qui ne se voit qu'à distance.
    const actuelle = { status: 'PENDING', onglet: 'x' }
    requeteAvec(actuelle, { status: '' })

    expect(actuelle).toEqual({ status: 'PENDING', onglet: 'x' })
  })
})
