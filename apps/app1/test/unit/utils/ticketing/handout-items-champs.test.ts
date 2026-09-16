import { describe, it, expect } from 'vitest'

import { calculateHandoutItemsForTicket } from '../../../../server/utils/ticketing/handout-items'

/**
 * Les articles dus au titre d'un CHAMP PERSONNALISÉ.
 *
 * Le rapprochement se faisait par comparaison de libellés contre l'instantané JSON figé à
 * l'achat : renommer un champ — ne serait-ce que pour corriger une faute — cessait de devoir
 * l'article aux billets déjà vendus, sans que rien ne le signale. Même défaut que celui corrigé
 * pour le décompte des quotas, à cela près qu'il ne se voyait nulle part : une jauge qui baisse
 * finit par surprendre, un bracelet qu'on ne remet plus, non.
 *
 * Les deux sites partagent désormais `reponseDesigneLeChamp`.
 */

/** Le champ tel que la configuration le porte, avec ses articles. */
const champAvecArticle = (
  overrides: Partial<{ id: number; label: string; helloAssoCustomFieldId: number | null }> = {},
  choiceValue: string | null = null
) => ({
  customField: {
    id: 12,
    label: 'Régime alimentaire',
    helloAssoCustomFieldId: 6402086,
    ...overrides,
    handoutItems: [
      {
        handoutItem: { id: 1, name: 'Repas végétarien', cumulative: false },
        quantity: 1,
        choiceValue,
      },
    ],
  },
})

const billet = (reponses: unknown[], champ = champAvecArticle()) => ({
  tier: { handoutItems: [], customFields: [champ] },
  customFields: reponses,
  selectedOptions: [],
})

/**
 * Le nom vit sous `handoutItem` : la fonction conserve la forme de l'association et n'y ajoute
 * que la quantité agrégée. Lire `article.name` rendait un tableau d'`undefined` — une assertion
 * qui échouait pour la mauvaise raison.
 */
const nomsDesArticles = (item: unknown) =>
  calculateHandoutItemsForTicket(item as never).map((article: any) => article.handoutItem.name)

describe('articles à remettre — les champs personnalisés', () => {
  it('reconnaît un billet saisi ici par son identifiant interne, malgré un renommage', () => {
    // Le libellé de l'instantané est l'ANCIEN : c'est tout l'enjeu.
    const articles = nomsDesArticles(
      billet([{ customFieldId: 12, name: 'Régime alimentare', answer: 'Végétarien' }])
    )

    expect(articles).toContain('Repas végétarien')
  })

  it('reconnaît un billet importé par l’identifiant du fournisseur, malgré un renommage', () => {
    const articles = nomsDesArticles(
      billet([{ id: 6402086, name: 'Ancien libellé', answer: 'Végétarien' }])
    )

    expect(articles).toContain('Repas végétarien')
  })

  it('retombe sur le libellé quand l’instantané ne porte aucun identifiant', () => {
    const articles = nomsDesArticles(billet([{ name: 'Régime alimentaire', answer: 'Végétarien' }]))

    expect(articles).toContain('Repas végétarien')
  })

  it('ne confond pas l’identifiant interne avec celui du fournisseur', () => {
    // 6402086 est l'identifiant FOURNISSEUR du champ ; posé comme identifiant interne, il désigne
    // un tout autre champ, et l'article n'est pas dû.
    const articles = nomsDesArticles(
      billet([{ customFieldId: 6402086, name: 'Régime alimentaire', answer: 'Végétarien' }])
    )

    expect(articles).toEqual([])
  })

  it('ne doit rien pour un champ que le billet ne désigne pas', () => {
    const articles = nomsDesArticles(
      billet([{ customFieldId: 99, name: 'Taille de t-shirt', answer: 'L' }])
    )

    expect(articles).toEqual([])
  })

  it('respecte le choix visé par l’article', () => {
    const champ = champAvecArticle({}, 'Végétarien')

    expect(nomsDesArticles(billet([{ customFieldId: 12, answer: 'Végétarien' }], champ))).toContain(
      'Repas végétarien'
    )

    expect(nomsDesArticles(billet([{ customFieldId: 12, answer: 'Omnivore' }], champ))).toEqual([])
  })
})
