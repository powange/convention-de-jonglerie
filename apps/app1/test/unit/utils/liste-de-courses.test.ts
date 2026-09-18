import { describe, expect, it } from 'vitest'

import {
  articlesParTags,
  articleSansObjet,
  listeTerminee,
  listesParObjet,
  objetsAAjouter,
  quantiteDeLArticle,
  resumeListe,
  type ArticleDeListe,
} from '../../../../../layers/stock/app/utils/liste-de-courses'
import type { ObjetManquant } from '../../../../../layers/stock/app/utils/manquants-stock'

/**
 * Les listes de courses tirées du recomptage.
 *
 * Le lien vers le matériel est VIVANT : l'article ne stocke ni nom ni quantité. Ce sont les
 * conséquences de ce choix qui s'éprouvent ici — la quantité qui bouge sous la liste, et l'objet
 * qui disparaît du stock.
 */
const item = (champs: Partial<ObjetManquant> = {}): ObjetManquant => ({
  id: 1,
  name: 'Gobelet',
  quantity: 10,
  finalQuantity: 7,
  group: { id: 1, name: 'Bar' },
  ...champs,
})

const article = (champs: Partial<ArticleDeListe> = {}): ArticleDeListe => ({
  id: 1,
  purchased: false,
  item: item(),
  ...champs,
})

describe('quantiteDeLArticle', () => {
  it('relit la quantité sur l’objet plutôt que de la garder figée', () => {
    expect(quantiteDeLArticle(article({ item: item({ quantity: 10, finalQuantity: 4 }) }))).toBe(6)
  })

  it('ne rend rien quand le manque a disparu', () => {
    // Quelqu'un a recompté et retrouvé les gobelets : l'article existe encore, mais il n'y a plus
    // rien à acheter. C'est la contrepartie du lien vivant, et l'écran doit pouvoir le dire.
    expect(
      quantiteDeLArticle(article({ item: item({ quantity: 10, finalQuantity: 10 }) }))
    ).toBeNull()
  })

  it('ne rend rien quand l’objet n’est plus là', () => {
    expect(quantiteDeLArticle(article({ item: null }))).toBeNull()
  })
})

describe('articleSansObjet', () => {
  it('signale un article non coché dont le manque a disparu', () => {
    expect(articleSansObjet(article({ item: item({ quantity: 10, finalQuantity: 10 }) }))).toBe(
      true
    )
  })

  it('laisse tranquille un article déjà coché', () => {
    // Il raconte un achat fait. Le signaler comme sans objet reviendrait à effacer ce qu'on vient
    // de faire — et c'est justement l'achat qui explique que plus rien ne manque.
    expect(
      articleSansObjet(
        article({ purchased: true, item: item({ quantity: 10, finalQuantity: 10 }) })
      )
    ).toBe(false)
  })

  it('ne signale rien tant qu’il manque vraiment quelque chose', () => {
    expect(articleSansObjet(article())).toBe(false)
  })
})

describe('resumeListe', () => {
  it('compte les articles cochés', () => {
    const resume = resumeListe([
      article({ id: 1, purchased: true }),
      article({ id: 2 }),
      article({ id: 3 }),
    ])

    expect(resume.achetes).toBe(1)
    expect(resume.total).toBe(3)
  })

  it('ne compte plus les exemplaires déjà achetés', () => {
    // La question posée en rayon est « que me reste-t-il à prendre ? ».
    const resume = resumeListe([
      article({ id: 1, purchased: true, item: item({ quantity: 10, finalQuantity: 0 }) }),
      article({ id: 2, item: item({ id: 2, quantity: 8, finalQuantity: 5 }) }),
    ])

    expect(resume.exemplairesRestants).toBe(3)
  })

  it('n’explose pas sur un article dont l’objet a disparu', () => {
    const resume = resumeListe([article({ item: null })])

    expect(resume).toEqual({ achetes: 0, total: 1, exemplairesRestants: 0 })
  })

  it('rend des zéros sur une liste vide', () => {
    expect(resumeListe([])).toEqual({ achetes: 0, total: 0, exemplairesRestants: 0 })
  })
})

describe('listeTerminee', () => {
  it('est vraie quand tout est coché', () => {
    expect(listeTerminee([article({ id: 1, purchased: true })])).toBe(true)
  })

  it('est fausse s’il reste un article', () => {
    expect(listeTerminee([article({ id: 1, purchased: true }), article({ id: 2 })])).toBe(false)
  })

  it('est fausse sur une liste vide', () => {
    // Une liste qu'on vient de créer n'est pas une liste finie : il n'y a rien dedans, ce qui
    // n'est pas la même chose que « tout est acheté ».
    expect(listeTerminee([])).toBe(false)
  })
})

describe('objetsAAjouter', () => {
  it('écarte ce qui est déjà dans la liste', () => {
    // La contrainte d'unicité refuserait le doublon en base : le filtrer ici évite de transformer
    // un geste anodin en erreur que l'utilisateur ne saurait pas quoi faire.
    const existants = [article({ id: 1, item: item({ id: 5 }) })]

    expect(objetsAAjouter([5, 7], existants)).toEqual([7])
  })

  it('dédoublonne la sélection elle-même', () => {
    expect(objetsAAjouter([7, 7, 8], [])).toEqual([7, 8])
  })

  it('ignore un article existant privé de son objet', () => {
    expect(objetsAAjouter([5], [article({ item: null })])).toEqual([5])
  })

  it('rend une liste vide quand tout est déjà là', () => {
    const existants = [article({ id: 1, item: item({ id: 5 }) })]

    expect(objetsAAjouter([5], existants)).toEqual([])
  })
})

describe('listesParObjet', () => {
  const liste = (id: number, name: string, items: ArticleDeListe[]) => ({ id, name, items })

  it('retourne l’index : une entrée par objet, les listes où il figure', () => {
    const index = listesParObjet([
      liste(1, 'Courses samedi', [article({ id: 10, item: item({ id: 5 }) })]),
      liste(2, 'Courses dimanche', [article({ id: 11, item: item({ id: 5 }), purchased: true })]),
    ])

    expect(index.get(5)).toEqual([
      { id: 1, name: 'Courses samedi', purchased: false },
      { id: 2, name: 'Courses dimanche', purchased: true },
    ])
  })

  it('garde l’ordre rendu par l’API, la liste la plus récente d’abord', () => {
    const index = listesParObjet([
      liste(2, 'Récente', [article({ id: 10, item: item({ id: 5 }) })]),
      liste(1, 'Ancienne', [article({ id: 11, item: item({ id: 5 }) })]),
    ])

    expect(index.get(5)?.map((appartenance) => appartenance.name)).toEqual(['Récente', 'Ancienne'])
  })

  it('ne dit rien d’un objet qui n’est dans aucune liste', () => {
    const index = listesParObjet([liste(1, 'Courses', [article({ item: item({ id: 5 }) })])])

    expect(index.get(7)).toBeUndefined()
  })

  it('ignore un article privé de son objet', () => {
    // Il ne désigne plus rien qu'une ligne de tableau puisse afficher.
    const index = listesParObjet([liste(1, 'Courses', [article({ item: null })])])

    expect(index.size).toBe(0)
  })

  it('n’a rien à dire de listes vides', () => {
    expect(listesParObjet([liste(1, 'Courses', [])]).size).toBe(0)
    expect(listesParObjet([]).size).toBe(0)
  })
})

describe('articlesParTags', () => {
  const tague = (...ids: number[]) =>
    item({ tags: ids.map((id) => ({ tag: { id, name: `t${id}`, color: '#000000' } })) })

  it('garde les articles qui portent au moins un des tags choisis', () => {
    // L'union et non le cumul : c'est la règle du stock entier, et deux écrans qui filtreraient
    // différemment sur les mêmes pastilles seraient un piège.
    const articles = [
      article({ id: 1, item: tague(1) }),
      article({ id: 2, item: tague(2) }),
      article({ id: 3, item: tague(3) }),
    ]

    expect(articlesParTags(articles, [1, 2]).map((a) => a.id)).toEqual([1, 2])
  })

  it('garde un article qui porte plusieurs tags dès que l’un est demandé', () => {
    const articles = [article({ id: 1, item: tague(4, 7) })]

    expect(articlesParTags(articles, [7]).map((a) => a.id)).toEqual([1])
  })

  it('ne filtre rien quand aucun tag n’est choisi', () => {
    const articles = [article({ id: 1, item: tague(1) }), article({ id: 2, item: item() })]

    expect(articlesParTags(articles, [])).toHaveLength(2)
  })

  it('écarte un article privé de son objet dès qu’un tag est demandé', () => {
    // Il ne porte plus de tag : rien ne permet de dire qu'il répond au filtre.
    const articles = [article({ id: 1, item: null }), article({ id: 2, item: tague(1) })]

    expect(articlesParTags(articles, [1]).map((a) => a.id)).toEqual([2])
  })

  it('garde un article privé de son objet tant qu’aucun tag n’est demandé', () => {
    expect(articlesParTags([article({ id: 1, item: null })], [])).toHaveLength(1)
  })

  it('écarte un objet sans aucun tag', () => {
    const articles = [article({ id: 1, item: item() })]

    expect(articlesParTags(articles, [1])).toEqual([])
  })
})
