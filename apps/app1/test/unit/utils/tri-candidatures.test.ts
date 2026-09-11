import { describe, expect, it } from 'vitest'

import {
  classementDesCandidatures,
  estColonneDeTri,
  fragmentDeTri,
  sensDeTri,
} from '../../../../../layers/volunteers/server/utils/tri-candidatures'

/**
 * La règle était écrite deux fois, et les deux copies avaient divergé : le tri secondaire sur les
 * allergies visait un champ de la candidature, alors qu'il vit sur le profil. Prisma refusait la
 * requête et la liste entière des candidatures partait en 500 — pour un geste aussi banal que
 * classer par équipe puis par allergies avant de composer les repas.
 *
 * Ces tests visent donc d'abord le point de divergence : le même champ doit produire le même
 * fragment, qu'il serve de colonne principale ou de départage.
 */
describe('fragmentDeTri', () => {
  it('classe les colonnes du profil à travers la relation', () => {
    expect(fragmentDeTri('allergies', 'asc')).toEqual({ user: { allergies: 'asc' } })
    expect(fragmentDeTri('pseudo', 'asc')).toEqual({ user: { pseudo: 'asc' } })
    expect(fragmentDeTri('prenom', 'desc')).toEqual({ user: { prenom: 'desc' } })
    expect(fragmentDeTri('nom', 'asc')).toEqual({ user: { nom: 'asc' } })
  })

  it('classe les colonnes de la candidature directement', () => {
    expect(fragmentDeTri('status', 'asc')).toEqual({ status: 'asc' })
    expect(fragmentDeTri('createdAt', 'desc')).toEqual({ createdAt: 'desc' })
    expect(fragmentDeTri('arrivalDateTime', 'asc')).toEqual({ arrivalDateTime: 'asc' })
    expect(fragmentDeTri('departureDateTime', 'desc')).toEqual({ departureDateTime: 'desc' })
  })

  it('écarte une colonne qu’on ne sait pas classer', () => {
    // Aucune retombée sur une colonne par défaut : l'appelant n'a pas demandé un autre tri.
    expect(fragmentDeTri('motivation', 'asc')).toBeNull()
    expect(fragmentDeTri('', 'asc')).toBeNull()
    expect(fragmentDeTri(undefined, 'asc')).toBeNull()
  })

  it('ne se laisse pas désigner une colonne par l’héritage des objets', () => {
    // `'constructor' in COLONNES` serait vrai sans un contrôle sur les propriétés propres, et
    // produirait un champ de tri que Prisma refuserait — le bug même qu'on referme ici.
    expect(fragmentDeTri('constructor', 'asc')).toBeNull()
    expect(fragmentDeTri('toString', 'asc')).toBeNull()
  })
})

describe('sensDeTri', () => {
  it('ne retient « asc » que s’il est demandé', () => {
    expect(sensDeTri('asc')).toBe('asc')
    expect(sensDeTri('desc')).toBe('desc')
  })

  it('retombe sur « desc » devant n’importe quoi d’autre', () => {
    // Le plus récent d'abord : c'est ce que l'API faisait déjà, et ce qu'on attend d'une liste
    // de candidatures qu'on ouvre sans rien préciser.
    expect(sensDeTri('ASC')).toBe('desc')
    expect(sensDeTri(undefined)).toBe('desc')
    expect(sensDeTri(1)).toBe('desc')
  })
})

describe('estColonneDeTri', () => {
  it('reconnaît les colonnes connues et rejette les autres', () => {
    expect(estColonneDeTri('allergies')).toBe(true)
    expect(estColonneDeTri('status')).toBe(true)
    expect(estColonneDeTri('petsDetails')).toBe(false)
    expect(estColonneDeTri(42)).toBe(false)
  })
})

describe('classementDesCandidatures', () => {
  it('trie les allergies en secondaire comme en principal', () => {
    // Le cœur du bug : le même champ, le même fragment, quelle que soit sa place.
    const [, secondaire] = classementDesCandidatures('status', 'asc', 'allergies:asc')

    expect(secondaire).toEqual({ user: { allergies: 'asc' } })
    expect(secondaire).toEqual(fragmentDeTri('allergies', 'asc'))
  })

  it('empile les départages dans l’ordre reçu', () => {
    expect(classementDesCandidatures('status', 'asc', 'nom:asc,allergies:desc')).toEqual([
      { status: 'asc' },
      { user: { nom: 'asc' } },
      { user: { allergies: 'desc' } },
    ])
  })

  it('retombe sur la date de candidature quand la colonne principale est inconnue', () => {
    // Il faut bien classer selon quelque chose : contrairement aux départages, la colonne
    // principale ne peut pas être simplement écartée.
    expect(classementDesCandidatures('motivation', 'desc')).toEqual([{ createdAt: 'desc' }])
    expect(classementDesCandidatures(undefined, 'asc')).toEqual([{ createdAt: 'asc' }])
  })

  it('ignore un départage inconnu sans perdre les autres', () => {
    expect(classementDesCandidatures('status', 'desc', 'motivation:asc,nom:asc')).toEqual([
      { status: 'desc' },
      { user: { nom: 'asc' } },
    ])
  })

  it('se contente de la colonne principale sans départage', () => {
    expect(classementDesCandidatures('nom', 'asc')).toEqual([{ user: { nom: 'asc' } }])
    expect(classementDesCandidatures('nom', 'asc', '')).toEqual([{ user: { nom: 'asc' } }])
    expect(classementDesCandidatures('nom', 'asc', null)).toEqual([{ user: { nom: 'asc' } }])
  })

  it('tolère les espaces et les virgules vides de la liste', () => {
    // La chaîne est composée par l'écran ; une virgule en trop ne doit pas coûter un classement.
    expect(classementDesCandidatures('status', 'asc', ' nom:asc , , allergies:desc ')).toEqual([
      { status: 'asc' },
      { user: { nom: 'asc' } },
      { user: { allergies: 'desc' } },
    ])
  })

  it('traite un départage sans sens comme décroissant', () => {
    expect(classementDesCandidatures('status', 'asc', 'nom')).toEqual([
      { status: 'asc' },
      { user: { nom: 'desc' } },
    ])
  })
})
