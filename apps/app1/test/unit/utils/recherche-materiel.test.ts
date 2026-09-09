import { describe, expect, it } from 'vitest'

import {
  filtrerParLieuEmprunt,
  filtrerParNom,
} from '../../../../../layers/stock/app/utils/recherche-materiel'

/**
 * Les lieux d'emprunt sont saisis à la main : « Chez Marie » et « chez Marie, 12 rue des Lilas »
 * cohabiteront dans la même édition. D'où une recherche par mots plutôt qu'une liste de valeurs.
 */
const STOCK = [
  { nom: 'Sono', pickupLocation: 'Chez Marie, 12 rue des Lilas', returnLocation: null },
  { nom: 'Chapiteau', pickupLocation: null, returnLocation: 'Local de l’association' },
  { nom: 'Praticable', pickupLocation: 'Gymnase', returnLocation: 'Chez Marie' },
  { nom: 'Rallonge', pickupLocation: null, returnLocation: null },
]

describe('filtrerParLieuEmprunt', () => {
  it('rend tout sans recherche', () => {
    expect(filtrerParLieuEmprunt(STOCK, '')).toHaveLength(4)
    expect(filtrerParLieuEmprunt(STOCK, '   ')).toHaveLength(4)
  })

  it('cherche dans le lieu de récupération comme dans celui de retour', () => {
    expect(filtrerParLieuEmprunt(STOCK, 'marie').map((o) => o.nom)).toEqual(['Sono', 'Praticable'])
  })

  it('exige tous les mots, dans un ordre quelconque', () => {
    expect(filtrerParLieuEmprunt(STOCK, 'lilas marie').map((o) => o.nom)).toEqual(['Sono'])
  })

  it('ne rapproche pas deux champs différents', () => {
    // « gymnase marie » : l'un est en récupération, l'autre en retour. Les tenir pour une seule
    // adresse ferait remonter un objet qui n'est nulle part à cet endroit.
    expect(filtrerParLieuEmprunt(STOCK, 'gymnase marie')).toEqual([])
  })

  it('ignore les accents et la casse', () => {
    expect(filtrerParLieuEmprunt(STOCK, 'LOCAL ASSOCIATION').map((o) => o.nom)).toEqual([
      'Chapiteau',
    ])
  })

  it('écarte le matériel sans aucun lieu dès qu’on cherche', () => {
    expect(filtrerParLieuEmprunt(STOCK, 'marie').map((o) => o.nom)).not.toContain('Rallonge')
  })
})

/**
 * La recherche par nom : la première chose qu'on tente quand on cherche un objet dans un stock
 * fourni, avant même de savoir dans quel groupe il est rangé.
 */
describe('filtrerParNom', () => {
  const STOCK = [
    { name: 'Rallonge 25 m' },
    { name: 'Rallonge 10 m' },
    { name: 'Enceinte amplifiée' },
    { name: 'Chapiteau', description: 'avec sa rallonge' },
  ]

  it('rend tout sans recherche', () => {
    expect(filtrerParNom(STOCK, '')).toHaveLength(4)
    expect(filtrerParNom(STOCK, '  ')).toHaveLength(4)
  })

  it('trouve sur un mot du nom', () => {
    expect(filtrerParNom(STOCK, 'rallonge').map((o) => o.name)).toEqual([
      'Rallonge 25 m',
      'Rallonge 10 m',
    ])
  })

  it('exige tous les mots, dans un ordre quelconque', () => {
    expect(filtrerParNom(STOCK, '25 rallonge').map((o) => o.name)).toEqual(['Rallonge 25 m'])
  })

  it('ignore les accents et la casse', () => {
    expect(filtrerParNom(STOCK, 'AMPLIFIEE').map((o) => o.name)).toEqual(['Enceinte amplifiée'])
  })

  it('ne cherche pas dans la description', () => {
    // Remonter un chapiteau parce que sa fiche mentionne une rallonge brouillerait le résultat.
    expect(filtrerParNom(STOCK, 'rallonge').map((o) => o.name)).not.toContain('Chapiteau')
  })

  it('tolère un objet sans nom', () => {
    expect(filtrerParNom([{ name: null }], 'rallonge')).toEqual([])
  })
})
