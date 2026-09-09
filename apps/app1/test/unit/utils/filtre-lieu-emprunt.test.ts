import { describe, expect, it } from 'vitest'

import { filtrerParLieuEmprunt } from '../../../../../layers/stock/app/utils/filtre-lieu-emprunt'

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
