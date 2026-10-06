/**
 * Les articles à remettre à une personne qui se présente au guichet.
 *
 * Ce module ne fait qu'une chose : réunir des articles venus de plusieurs sources en UNE liste à
 * cocher. Il ne décide pas de ce qui est dû — le serveur l'a déjà fait, tarif, options et champs
 * personnalisés compris — et il ne valide rien.
 *
 * ⚠️ POURQUOI IL EXISTE. Ce calcul vivait dans `ParticipantDetailsModal`, pour UN titre à la fois.
 * Le contrôle d'accès sait désormais qu'une même personne porte plusieurs titres — un billet ET
 * une place d'organisateur, par exemple — et doit annoncer, en un seul écran, tout ce qu'on lui
 * remet. Recopier le calcul l'aurait fait diverger : le commentaire qu'il portait disait déjà
 * « la règle n'a qu'un seul endroit où vivre », après qu'un bracelet non cumulable se fut affiché
 * en deux lignes pour avoir été compté deux fois.
 */

/** Un article tel que le serveur le rend pour une ligne de COMMANDE : l'origine y est portée. */
export interface ArticleDeBillet {
  handoutItem: { id: number; name: string }
  quantity?: number | null
  /** D'où vient l'article : le tarif, une option, un champ personnalisé. */
  source?: string | null
  customFieldName?: string | null
  optionName?: string | null
}

/** Un article tel que le serveur le rend pour un bénévole, un artiste ou un organisateur. */
export interface ArticleDePersonne {
  id: number
  name: string
  quantity?: number | null
}

/**
 * Une source d'articles : un titre, et ce qu'il donne droit à recevoir.
 *
 * `ligne` n'existe que pour les billets : c'est l'identifiant de la LIGNE de commande. Deux lignes
 * d'une même commande donnant le même article doivent compter DEUX fois — deux pass, deux
 * bracelets —, alors qu'un même article arrivant deux fois sur une seule ligne n'en vaut qu'un.
 */
export type SourceDArticles =
  | { nature: 'ticket'; porteur: string; ligne: number | string; articles: ArticleDeBillet[] }
  | {
      nature: 'volunteer' | 'artist' | 'organizer'
      porteur: string
      articles: ArticleDePersonne[]
    }

/** Une ligne à cocher, dans la forme qu'attend `UiConfirmModal`. */
export interface ArticleACocher {
  id: string
  name: string
  participantName?: string
}

/**
 * Le nom affiché d'un article de billet, enrichi de son origine quand elle éclaire ce qu'on remet.
 *
 * « Tee-shirt (Taille du tee-shirt) » ou « Bracelet (Camping) » dit d'où sort l'article mieux que
 * son seul nom, au moment où l'on fouille un carton pour le trouver.
 */
function nomAvecOrigine(article: ArticleDeBillet): string {
  if (article.source === 'customField' && article.customFieldName) {
    return `${article.handoutItem.name} (${article.customFieldName})`
  }
  if (article.source === 'option' && article.optionName) {
    return `${article.handoutItem.name} (${article.optionName})`
  }
  return article.handoutItem.name
}

/**
 * Réunit les articles de plusieurs sources en une liste à cocher.
 *
 * ⚠️ UN ARTICLE N'APPARAÎT QU'UNE FOIS, suivi du total. Un artiste qui joue dans deux spectacles
 * reçoit le même bracelet au titre des deux : l'afficher deux fois ferait cocher deux cases pour
 * un seul objet, et le guichet finirait par en donner deux.
 *
 * 📍 En revanche la clé de regroupement comprend la SOURCE, jamais seulement l'article : le même
 * tee-shirt dû au titre d'un billet et au titre d'une place d'organisateur fait bien deux
 * tee-shirts, et doit se compter deux fois. C'est exactement le cas qu'on vient servir.
 */
export function listeDesArticlesARemettre(sources: SourceDArticles[]): ArticleACocher[] {
  const totaux = new Map<string, { nom: string; porteur: string; quantite: number }>()

  const ajouter = (cle: string, nom: string, quantite: number, porteur: string) => {
    const existant = totaux.get(cle)
    if (existant) existant.quantite += quantite
    else totaux.set(cle, { nom, porteur, quantite })
  }

  for (const source of sources) {
    if (source.nature === 'ticket') {
      for (const article of source.articles) {
        ajouter(
          `${source.ligne}-${article.handoutItem.id}`,
          nomAvecOrigine(article),
          article.quantity ?? 1,
          source.porteur
        )
      }
      continue
    }

    for (const article of source.articles) {
      ajouter(`${source.nature}-${article.id}`, article.name, article.quantity ?? 1, source.porteur)
    }
  }

  /*
   * L'identifiant est bâti sur la CLÉ de regroupement, jamais sur le nom : il sert d'`id` HTML à
   * la case à cocher, et un nom porte espaces et parenthèses — « Tee-shirt (Camping) » —, qui
   * donnent un `id` invalide et rompent l'appairage avec son libellé. On ne peut alors plus
   * cocher en cliquant le texte, défaut qu'on ne voit qu'en essayant.
   *
   * L'index, lui, garantit l'unicité : deux cases au même identifiant se cocheraient ensemble, et
   * l'on validerait une entrée sans avoir rien remis.
   */
  let index = 0
  return [...totaux.entries()].map(([cle, entree]) => ({
    id: `${cle}-${index++}`,
    name: `${entree.nom}${entree.quantite > 1 ? ` ×${entree.quantite}` : ''} - ${entree.porteur}`,
    participantName: entree.porteur,
  }))
}
