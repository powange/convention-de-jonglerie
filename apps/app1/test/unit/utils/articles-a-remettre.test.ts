import { describe, expect, it } from 'vitest'

import {
  listeDesArticlesARemettre,
  type SourceDArticles,
} from '../../../../../layers/ticketing/app/utils/articles-a-remettre'

/**
 * La liste des articles à remettre au guichet.
 *
 * ⚠️ POURQUOI CES TESTS. Une erreur ici ne se voit pas : elle fait remettre DEUX bracelets au lieu
 * d'un, ou n'en fait remettre aucun. Personne ne s'en aperçoit sur le moment — c'est au stock, en
 * fin d'événement, que le compte ne tombe plus.
 */

const articleDeBillet = (id: number, name: string, over = {}) => ({
  handoutItem: { id, name },
  quantity: 1,
  ...over,
})

describe('réunir les articles de plusieurs titres', () => {
  it('LE CAS QU’ON VIENT SERVIR : un billet ET une place d’organisateur', () => {
    /*
     * ⚠️ Le même tee-shirt dû à deux titres fait DEUX tee-shirts. C'est le cas que l'utilisateur a
     * trouvé : une organisatrice qui a aussi un billet à tarif particulier, chacun donnant droit à
     * des articles. Les fusionner en un seul n'en ferait remettre qu'un.
     */
    const sources: SourceDArticles[] = [
      {
        nature: 'ticket',
        porteur: 'Emma Omer',
        ligne: 42,
        articles: [articleDeBillet(1, 'Tee-shirt')],
      },
      { nature: 'organizer', porteur: 'Emma Omer', articles: [{ id: 1, name: 'Tee-shirt' }] },
    ]

    const liste = listeDesArticlesARemettre(sources)

    expect(liste).toHaveLength(2)
    for (const article of liste) {
      expect(article.name).toContain('Tee-shirt')
      // Aucun des deux ne porte « ×2 » : ce sont deux lignes d'un exemplaire, pas une de deux.
      expect(article.name).not.toContain('×')
    }
  })

  it('mais un article dû DEUX FOIS par le même titre ne compte qu’une ligne, avec son total', () => {
    /*
     * Un artiste qui joue dans deux spectacles reçoit le même bracelet au titre des deux. Deux
     * cases pour un objet feraient remettre deux bracelets ; une case « ×2 » dit la vérité.
     */
    const liste = listeDesArticlesARemettre([
      {
        nature: 'artist',
        porteur: 'Ada',
        articles: [
          { id: 7, name: 'Bracelet', quantity: 1 },
          { id: 7, name: 'Bracelet', quantity: 1 },
        ],
      },
    ])

    expect(liste).toHaveLength(1)
    expect(liste[0]!.name).toContain('×2')
  })

  it('deux LIGNES de commande donnant le même article font bien deux articles', () => {
    // Deux pass achetés sur une même commande : deux bracelets, pas un.
    const liste = listeDesArticlesARemettre([
      { nature: 'ticket', porteur: 'A', ligne: 1, articles: [articleDeBillet(3, 'Bracelet')] },
      { nature: 'ticket', porteur: 'A', ligne: 2, articles: [articleDeBillet(3, 'Bracelet')] },
    ])

    expect(liste).toHaveLength(2)
  })

  it('dit d’OÙ sort un article quand ce n’est pas le tarif', () => {
    // « Tee-shirt (Taille du tee-shirt) » se retrouve dans un carton ; « Tee-shirt » seul, non.
    const liste = listeDesArticlesARemettre([
      {
        nature: 'ticket',
        porteur: 'A',
        ligne: 1,
        articles: [
          articleDeBillet(1, 'Tee-shirt', { source: 'customField', customFieldName: 'Taille' }),
          articleDeBillet(2, 'Bracelet', { source: 'option', optionName: 'Camping' }),
        ],
      },
    ])

    expect(liste.map((a) => a.name.split(' - ')[0])).toEqual([
      'Tee-shirt (Taille)',
      'Bracelet (Camping)',
    ])
  })

  it('donne à chaque case un identifiant UNIQUE et utilisable en HTML', () => {
    /*
     * ⚠️ L'`id` sert d'attribut HTML, apparié au `for` du libellé. Un identifiant répété ferait
     * cocher deux cases ensemble — on validerait sans avoir tout remis —, et un identifiant
     * contenant un espace romprait l'appairage, rendant le libellé non cliquable.
     */
    const liste = listeDesArticlesARemettre([
      {
        nature: 'ticket',
        porteur: 'A',
        ligne: 1,
        articles: [
          articleDeBillet(1, 'Tee-shirt (grand)', { source: 'option', optionName: 'Camping' }),
          articleDeBillet(2, 'Bracelet'),
        ],
      },
      { nature: 'volunteer', porteur: 'A', articles: [{ id: 1, name: 'Bracelet' }] },
    ])

    const ids = liste.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id, `identifiant « ${id} »`).not.toMatch(/[\s()]/)
    }
  })

  it('porte le nom de la personne, pour un guichet qui sert plusieurs files', () => {
    const liste = listeDesArticlesARemettre([
      { nature: 'volunteer', porteur: 'Emma Omer', articles: [{ id: 1, name: 'Bracelet' }] },
    ])

    expect(liste[0]!.name).toContain('Emma Omer')
    expect(liste[0]!.participantName).toBe('Emma Omer')
  })

  it('rend une liste vide quand il n’y a rien à remettre', () => {
    expect(listeDesArticlesARemettre([])).toEqual([])
    expect(
      listeDesArticlesARemettre([{ nature: 'organizer', porteur: 'A', articles: [] }])
    ).toEqual([])
  })
})
