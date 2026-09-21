import { describe, expect, it } from 'vitest'

import { filtrerParTags } from '../../../../../layers/stock/app/utils/filtre-tags-stock'
import {
  filtrerParGroupes,
  groupesDesObjets,
  tagsDesObjets,
} from '../../../../../layers/stock/app/utils/filtres-objets-stock'
// La recherche par nom vient du module, pas d'ici : elle est éprouvée dans son propre fichier.
// Elle figure dans ce fichier-ci uniquement pour vérifier qu'elle se COMPOSE avec les deux
// autres, ce qu'aucun des deux fichiers ne dirait seul.
import { filtrerParNom } from '../../../../../layers/stock/app/utils/recherche-materiel'

/**
 * Les filtres que partagent les tableaux du stock.
 *
 * Ils sont nés dans la page des emprunts, sous des noms qui parlaient d'emprunts. Les reprendre
 * pour le recomptage a montré qu'ils ne parlaient pas d'emprunts du tout : ces tests les
 * éprouvent donc sur des objets nus, sans rien de ce que chaque écran leur ajoute.
 *
 * Les identifiants des fixtures contredisent volontairement l'ordre alphabétique — « Fragile »
 * porte le 2 et « Lourd » le 1. Sans cette inversion, un classement par identifiant passerait
 * les tests de classement par nom.
 */
const FRAGILE = { id: 2, name: 'Fragile', color: '#ef4444' }
const LOURD = { id: 1, name: 'Lourd', color: '#3b82f6' }
const CUISINE = { id: 20, name: 'Cuisine' }
const SCENE = { id: 10, name: 'Scène' }

const objet = (
  nom: string,
  groupe: { id: number; name: string } | null,
  tags: Array<{ id: number; name: string; color: string }> = []
) => ({
  name: nom,
  group: groupe,
  tags: tags.map((tag) => ({ tag })),
})

describe('groupesDesObjets', () => {
  it('ne rend chaque groupe qu’une fois, quel que soit le nombre d’objets', () => {
    const groupes = groupesDesObjets([
      objet('Marmite', CUISINE),
      objet('Louche', CUISINE),
      objet('Projecteur', SCENE),
    ])
    expect(groupes).toEqual([CUISINE, SCENE])
  })

  it('classe par NOM et non par identifiant', () => {
    // L'identifiant ne dit rien à qui lit la liste, et l'ordre de la base encore moins.
    expect(groupesDesObjets([objet('a', SCENE), objet('b', CUISINE)]).map((g) => g.name)).toEqual([
      'Cuisine',
      'Scène',
    ])
  })

  it('ignore un objet sans groupe plutôt que de lever', () => {
    expect(groupesDesObjets([objet('orphelin', null), objet('Marmite', CUISINE)])).toEqual([
      CUISINE,
    ])
  })

  it('rend une liste vide quand il n’y a rien', () => {
    expect(groupesDesObjets([])).toEqual([])
  })
})

describe('tagsDesObjets', () => {
  it('réunit les tags de tous les objets, sans doublon', () => {
    const tags = tagsDesObjets([
      objet('Marmite', CUISINE, [FRAGILE]),
      objet('Louche', CUISINE, [FRAGILE, LOURD]),
    ])
    // Classés par NOM : « Fragile » avant « Lourd », alors que leurs identifiants disent
    // l'inverse.
    expect(tags).toEqual([FRAGILE, LOURD])
  })

  it('garde la COULEUR, dont le sélecteur a besoin', () => {
    // On reconnaît un tag à sa couleur : c'est précisément pour cela qu'on l'a posé.
    expect(tagsDesObjets([objet('Marmite', CUISINE, [FRAGILE])])[0]?.color).toBe('#ef4444')
  })

  it('tient debout sur un objet sans tag', () => {
    expect(tagsDesObjets([objet('Marmite', CUISINE)])).toEqual([])
    expect(tagsDesObjets([{ name: 'x', group: CUISINE } as never])).toEqual([])
  })
})

describe('filtrerParGroupe', () => {
  const liste = [objet('Marmite', CUISINE), objet('Projecteur', SCENE)]

  it('ne garde que les objets du groupe choisi', () => {
    expect(filtrerParGroupes(liste, [CUISINE.id]).map((o) => o.name)).toEqual(['Marmite'])
  })

  it('NE FILTRE RIEN sans groupe choisi', () => {
    // Un filtre vide ne doit pas vider l'écran — même règle que `filtrerParEtape`.
    expect(filtrerParGroupes(liste, null)).toHaveLength(2)
    expect(filtrerParGroupes(liste, undefined)).toHaveLength(2)
  })

  it('compare l’IDENTIFIANT et non le nom', () => {
    // Deux groupes peuvent porter le même intitulé, et c'est le genre d'égalité qui se
    // découvre tard.
    const homonyme = { id: 99, name: 'Cuisine' }
    expect(filtrerParGroupes([objet('Marmite', CUISINE)], [homonyme.id])).toEqual([])
  })
})

describe('les filtres multiples cumulent en OU', () => {
  /**
   * Le OU est le seul sens qui rende quelque chose.
   *
   * Un ET sur les groupes ne rendrait JAMAIS rien — un objet n'est rangé qu'à un endroit. Sur les
   * tags il rendrait presque toujours vide, et il faudrait le deviner : rien à l'écran ne dit si
   * deux cases cochées veulent dire « l'un ou l'autre » ou « les deux à la fois ».
   */
  const AUTRE = { id: 3, name: 'Atelier' }
  const liste = [
    objet('Marmite', CUISINE, [FRAGILE]),
    objet('Projecteur', SCENE, [LOURD]),
    objet('Établi', AUTRE, []),
  ]

  it('retient les objets de CHACUN des groupes choisis', () => {
    expect(filtrerParGroupes(liste, [CUISINE.id, SCENE.id]).map((o) => o.name)).toEqual([
      'Marmite',
      'Projecteur',
    ])
  })

  it('traite une liste VIDE comme une absence de filtre', () => {
    // Décocher la dernière case doit tout rendre, pas tout cacher.
    expect(filtrerParGroupes(liste, [])).toHaveLength(3)
  })

  it('ignore un identifiant qui ne correspond à rien', () => {
    expect(filtrerParGroupes(liste, [CUISINE.id, 999]).map((o) => o.name)).toEqual(['Marmite'])
  })

  it('s’enchaîne avec le filtre par tags sans se contredire', () => {
    // Groupe PUIS tag : les deux filtres se composent en ET entre eux, en OU à l'intérieur.
    // Le filtre par tags vient du module (`filtre-tags-stock`) : ce qui se vérifie ici, c'est
    // leur composition sur cet écran, pas le filtre lui-même, éprouvé de son côté.
    const parGroupe = filtrerParGroupes(liste, [CUISINE.id, SCENE.id])
    expect(filtrerParTags(parGroupe, [LOURD.id]).map((o) => o.name)).toEqual(['Projecteur'])
  })
})

describe('les trois filtres se composent', () => {
  const liste = [
    objet('Marmite', CUISINE, [FRAGILE]),
    objet('Marmite à pression', CUISINE, [LOURD]),
    objet('Marmite de scène', SCENE, [FRAGILE]),
  ]

  it('s’enchaînent en ET, chacun restant un OU à l’intérieur', () => {
    const parNom = filtrerParNom(liste, 'marmite')
    const parGroupe = filtrerParGroupes(parNom, [CUISINE.id])
    expect(filtrerParTags(parGroupe, [FRAGILE.id]).map((o) => o.name)).toEqual(['Marmite'])
  })

  it('rendent la liste entière quand aucun n’est posé', () => {
    expect(filtrerParTags(filtrerParGroupes(filtrerParNom(liste, ''), []), [])).toHaveLength(3)
  })
})
