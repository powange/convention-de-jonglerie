import { describe, expect, it } from 'vitest'

import {
  filtrerParTags,
  tagsDepuisUrl,
  urlDepuisTags,
} from '../../../../../layers/stock/app/utils/filtre-tags-stock'

/**
 * Les tags traversent les groupes de rangement : le filtre est ce qui les rend utiles, puisqu'il
 * permet de retrouver « tout ce qui est fragile » sans savoir où c'est rangé.
 */
const objet = (nom: string, ...tagIds: number[]) => ({
  nom,
  tags: tagIds.map((id) => ({ tag: { id } })),
})

const FRAGILE = 1
const PRETE = 2
const LOURD = 3

const STOCK = [
  objet('Enceinte', FRAGILE, PRETE, LOURD),
  objet('Massues', FRAGILE),
  objet('Praticable', LOURD),
  objet('Rallonge'),
]

describe('filtrerParTags', () => {
  it('rend tout quand aucun tag n’est choisi', () => {
    expect(filtrerParTags(STOCK, [])).toHaveLength(4)
  })

  it('garde les objets portant le tag choisi', () => {
    expect(filtrerParTags(STOCK, [FRAGILE]).map((o) => o.nom)).toEqual(['Enceinte', 'Massues'])
  })

  it('élargit la liste quand on ajoute un tag', () => {
    // L'union, et non le cumul : les tags décrivent des qualités indépendantes, et en exiger
    // deux à la fois ne donnait presque jamais de résultat.
    expect(filtrerParTags(STOCK, [FRAGILE, LOURD]).map((o) => o.nom)).toEqual([
      'Enceinte',
      'Massues',
      'Praticable',
    ])
  })

  it('ignore un tag que personne ne porte', () => {
    expect(filtrerParTags(STOCK, [PRETE, 99]).map((o) => o.nom)).toEqual(['Enceinte'])
  })

  it('rend une liste vide quand aucun objet ne porte les tags choisis', () => {
    expect(filtrerParTags(STOCK, [99])).toEqual([])
  })

  it('écarte un objet sans aucun tag dès qu’un filtre est posé', () => {
    expect(filtrerParTags(STOCK, [FRAGILE]).map((o) => o.nom)).not.toContain('Rallonge')
  })

  it('tolère un objet dont les tags sont absents ou nuls', () => {
    const bancals = [{ nom: 'Sans champ' }, { nom: 'Nul', tags: null }]

    expect(filtrerParTags(bancals, [])).toHaveLength(2)
    expect(filtrerParTags(bancals, [FRAGILE])).toEqual([])
  })
})

/**
 * Le filtre vit dans l'URL : un lien se partage, un rechargement ne le perd pas. L'adresse étant
 * ce qu'un utilisateur peut modifier à la main, l'analyse doit tolérer n'importe quoi.
 */
describe('tagsDepuisUrl', () => {
  it('lit une liste séparée par des virgules', () => {
    expect(tagsDepuisUrl('1,2,3')).toEqual([1, 2, 3])
  })

  it('tolère les espaces et les doublons', () => {
    expect(tagsDepuisUrl(' 2 , 1 ,2 ')).toEqual([2, 1])
  })

  it('écarte ce qui n’est pas un identifiant', () => {
    expect(tagsDepuisUrl('1,abc,,0,-3,2')).toEqual([1, 2])
  })

  it('rend une liste vide pour une valeur absente', () => {
    expect(tagsDepuisUrl(undefined)).toEqual([])
    expect(tagsDepuisUrl('')).toEqual([])
    expect(tagsDepuisUrl(null)).toEqual([])
  })

  it('accepte le paramètre répété, que Vue Router rend en tableau', () => {
    expect(tagsDepuisUrl(['1', '2'])).toEqual([1, 2])
  })
})

describe('urlDepuisTags', () => {
  it('compose la valeur du paramètre', () => {
    expect(urlDepuisTags([1, 2])).toBe('1,2')
  })

  it('retire le paramètre plutôt que de laisser un reste vide', () => {
    // Un « ?tags= » traînerait dans l'adresse après avoir tout décoché, et se partagerait ainsi.
    expect(urlDepuisTags([])).toBeUndefined()
  })

  it('fait l’aller-retour sans rien perdre', () => {
    expect(tagsDepuisUrl(urlDepuisTags([3, 7]))).toEqual([3, 7])
  })
})
