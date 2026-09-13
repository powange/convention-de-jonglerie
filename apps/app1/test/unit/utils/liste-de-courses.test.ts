import { describe, expect, it } from 'vitest'

import {
  articleSansObjet,
  listeTerminee,
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
