import { describe, expect, it } from 'vitest'

import {
  articleRetenu,
  articlesRetenus,
  filtresDArticlesActifs,
} from '../../../shared/utils/articles-de-commande-retenus'

/**
 * Le tri des articles d'une commande selon les filtres de l'écran.
 *
 * Ce que ces tests protègent est un chiffre qu'on lit pour décider : « combien de pass 3 jours
 * avons-nous vendus ? ». Le défaut d'origine comptait DEUX billets pour une commande qui n'en
 * portait qu'un au tarif demandé, parce que la requête retient des commandes et que le bandeau
 * comptait leurs articles.
 *
 * L'exigence centrale de ce fichier : rendre exactement le même verdict que les conditions
 * Prisma de la requête. Une divergence griserait à l'écran un article que la requête a retenu,
 * ou compterait un article qu'elle a écarté — deux façons silencieuses de mentir.
 */

const BILLET = { tierId: 72, entryValidated: false, selectedOptions: [], type: 'Participant' }

describe('filtresDArticlesActifs', () => {
  it('est faux quand aucun filtre d’article n’est posé', () => {
    // Sans filtre, rien ne doit changer : les totaux restent ceux qu'ils ont toujours été.
    expect(filtresDArticlesActifs({})).toBe(false)
    expect(filtresDArticlesActifs({ tierIds: [], optionIds: [], itemTypes: [] })).toBe(false)
    expect(filtresDArticlesActifs({ entryStatus: null })).toBe(false)
  })

  it('ne confond pas un filtre de COMMANDE avec un filtre d’article', () => {
    // `entryStatus` ne prend que deux valeurs qui filtrent des articles ; tout le reste — dont
    // « toutes » — laisse la commande entière intacte.
    expect(filtresDArticlesActifs({ entryStatus: 'all' })).toBe(false)
    expect(filtresDArticlesActifs({ entryStatus: 'validated' })).toBe(true)
    expect(filtresDArticlesActifs({ entryStatus: 'not_validated' })).toBe(true)
  })

  it('est vrai dès qu’un seul critère est posé', () => {
    expect(filtresDArticlesActifs({ tierIds: [72] })).toBe(true)
    expect(filtresDArticlesActifs({ optionIds: [3] })).toBe(true)
    expect(filtresDArticlesActifs({ itemTypes: ['Donation'] })).toBe(true)
  })
})

describe('articleRetenu — le tarif', () => {
  it('retient l’article du tarif demandé', () => {
    expect(articleRetenu(BILLET, { tierIds: [72] })).toBe(true)
  })

  it('écarte l’article d’un AUTRE tarif de la même commande', () => {
    // Le cas signalé : une commande à deux tarifs, dont un seul est demandé.
    expect(articleRetenu({ ...BILLET, tierId: 73 }, { tierIds: [72] })).toBe(false)
  })

  it('écarte un article sans tarif', () => {
    // Un don n'a pas de tarif : `tierId: { in: [...] }` ne le retient jamais. Le compter
    // reviendrait à ajouter un don au décompte d'un tarif.
    expect(articleRetenu({ ...BILLET, tierId: null }, { tierIds: [72] })).toBe(false)
  })

  it('ne filtre rien quand la liste de tarifs est vide', () => {
    expect(articleRetenu({ ...BILLET, tierId: 999 }, { tierIds: [] })).toBe(true)
  })
})

describe('articleRetenu — l’entrée validée', () => {
  it('sépare les deux états', () => {
    const valide = { ...BILLET, entryValidated: true }
    expect(articleRetenu(valide, { entryStatus: 'validated' })).toBe(true)
    expect(articleRetenu(valide, { entryStatus: 'not_validated' })).toBe(false)
    expect(articleRetenu(BILLET, { entryStatus: 'validated' })).toBe(false)
    expect(articleRetenu(BILLET, { entryStatus: 'not_validated' })).toBe(true)
  })

  it('range un état INCONNU du côté « non validée », comme la base', () => {
    // La requête écrit `{ not: true }` : tout ce qui n'est pas `true` en relève, `null` compris.
    // Le traiter comme une absence de valeur ferait disparaître ces billets des DEUX filtres.
    const inconnu = { ...BILLET, entryValidated: null }
    expect(articleRetenu(inconnu, { entryStatus: 'not_validated' })).toBe(true)
    expect(articleRetenu(inconnu, { entryStatus: 'validated' })).toBe(false)
  })
})

describe('articleRetenu — les options', () => {
  const avecOptions = { ...BILLET, selectedOptions: [{ optionId: 3 }, { optionId: 5 }] }

  it('retient sur AU MOINS une option, pas sur toutes', () => {
    expect(articleRetenu(avecOptions, { optionIds: [5, 9] })).toBe(true)
  })

  it('écarte l’article qui ne porte aucune des options demandées', () => {
    expect(articleRetenu(avecOptions, { optionIds: [9] })).toBe(false)
  })

  it('écarte un article sans option', () => {
    expect(articleRetenu({ ...BILLET, selectedOptions: [] }, { optionIds: [3] })).toBe(false)
    expect(articleRetenu({ ...BILLET, selectedOptions: null }, { optionIds: [3] })).toBe(false)
  })
})

describe('articleRetenu — la nature de l’article', () => {
  it('retient les natures demandées', () => {
    expect(articleRetenu({ ...BILLET, type: 'Donation' }, { itemTypes: ['Donation'] })).toBe(true)
    expect(articleRetenu(BILLET, { itemTypes: ['Donation'] })).toBe(false)
  })
})

describe('articleRetenu — la combinaison', () => {
  it('exige TOUS les critères, comme le AND de la requête', () => {
    // Un article du bon tarif mais non validé ne passe pas le second critère. Combiner en OU
    // gonflerait chaque compte dès qu'on croise deux filtres.
    const filtres = { tierIds: [72], entryStatus: 'validated' }
    expect(articleRetenu(BILLET, filtres)).toBe(false)
    expect(articleRetenu({ ...BILLET, entryValidated: true }, filtres)).toBe(true)
    expect(articleRetenu({ ...BILLET, entryValidated: true, tierId: 73 }, filtres)).toBe(false)
  })
})

describe('articlesRetenus', () => {
  const COMMANDE = [
    { id: 1, tierId: 72, type: 'Participant', entryValidated: false, selectedOptions: [] },
    { id: 2, tierId: 73, type: 'Participant', entryValidated: false, selectedOptions: [] },
  ]

  it('ne garde que l’article du tarif demandé', () => {
    // Le signalement, en une ligne : une commande, deux billets, un seul au tarif choisi.
    expect(articlesRetenus(COMMANDE, { tierIds: [72] }).map((a) => a.id)).toEqual([1])
  })

  it('rend la commande ENTIÈRE quand aucun filtre d’article n’est posé', () => {
    // Et non une liste filtrée par accident : sans filtre, le bandeau doit afficher exactement
    // ce qu'il affichait avant que ce tri existe.
    expect(articlesRetenus(COMMANDE, {}).map((a) => a.id)).toEqual([1, 2])
  })

  it('préserve l’ordre des articles', () => {
    expect(articlesRetenus(COMMANDE, { itemTypes: ['Participant'] }).map((a) => a.id)).toEqual([
      1, 2,
    ])
  })

  it('peut ne rien garder', () => {
    expect(articlesRetenus(COMMANDE, { tierIds: [999] })).toEqual([])
  })
})
