/**
 * Une liste de courses, et ce qu'il en reste à acheter.
 *
 * Ce qui distingue une liste de courses d'un export, c'est qu'on la coche en marchant dans les
 * rayons. D'où la seule donnée que l'article porte en propre — `purchased` — et d'où ce fichier,
 * qui dit ce que cette case change à la lecture de la liste.
 *
 * ⚠️ L'article ne stocke NI nom NI quantité : le lien vers le matériel est vivant. La quantité à
 * racheter se relit donc sur l'objet à chaque affichage, et un recomptage la fait bouger — y
 * compris sur une liste déjà imprimée. C'est le choix assumé à la conception ; le noter ici parce
 * que c'est la surprise la plus probable à la lecture du code.
 *
 * ⚠️ Ce fichier ne doit rien importer d'autre que les règles de comptage : il est chargé tel quel
 * par les tests unitaires, hors Nuxt.
 */

import { quantiteARacheter, type ObjetManquant } from './manquants-stock'

/** Un article de liste, tel que l'écran le reçoit : la case, et l'objet visé. */
export interface ArticleDeListe {
  id: number
  purchased: boolean
  /**
   * L'objet du stock.
   *
   * `null` n'arrive pas en base — la suppression d'un objet emporte l'article en cascade —, mais
   * le type l'admet pour que l'écran ne suppose jamais sa présence sur une réponse d'API plus
   * ancienne que ce réglage.
   */
  item: ObjetManquant | null
}

/**
 * Combien d'exemplaires cet article demande d'acheter.
 *
 * `null` quand l'objet a disparu, ou quand il ne manque plus rien — ce second cas se produit
 * vraiment : quelqu'un recompte une caisse, retrouve les gobelets, et l'article devient sans
 * objet alors que la liste existe toujours. L'écran doit pouvoir le dire plutôt qu'afficher un
 * zéro qu'on lirait comme « rien à acheter ici » sans comprendre pourquoi.
 */
export function quantiteDeLArticle(article: ArticleDeListe): number | null {
  return article.item ? quantiteARacheter(article.item) : null
}

/**
 * L'article est-il devenu sans objet&nbsp;?
 *
 * Un article coché reste affiché tel quel : il raconte un achat fait, et le retirer de la liste
 * effacerait ce qu'on vient de faire. Seul un article NON coché dont le manque a disparu mérite
 * d'être signalé — c'est du travail en moins, à condition de le voir.
 */
export function articleSansObjet(article: ArticleDeListe): boolean {
  return !article.purchased && quantiteDeLArticle(article) === null
}

/** Ce que la liste annonce en tête. */
export interface ResumeListe {
  /** Combien d'articles sont cochés. */
  achetes: number
  /** Combien d'articles en tout. */
  total: number
  /** Combien d'exemplaires restent à acheter, articles cochés exclus. */
  exemplairesRestants: number
}

/**
 * Où en sont les courses.
 *
 * Les exemplaires des articles cochés ne comptent plus : la question posée en rayon est « que
 * me reste-t-il à prendre&nbsp;? », pas « qu'y avait-il au départ&nbsp;? ».
 */
export function resumeListe(articles: ArticleDeListe[]): ResumeListe {
  let achetes = 0
  let exemplairesRestants = 0

  for (const article of articles) {
    if (article.purchased) {
      achetes += 1
      continue
    }
    exemplairesRestants += quantiteDeLArticle(article) ?? 0
  }

  return { achetes, total: articles.length, exemplairesRestants }
}

/** La liste est-elle finie ? Vide, elle ne l'est pas : il n'y a simplement rien dedans. */
export function listeTerminee(articles: ArticleDeListe[]): boolean {
  return articles.length > 0 && articles.every((article) => article.purchased)
}

/**
 * Parmi les objets choisis, ceux qu'il reste à ajouter à cette liste.
 *
 * Ajouter deux fois le même objet est refusé en base par une contrainte d'unicité. Le filtrer ici
 * évite de transformer un geste anodin — cocher un objet déjà présent — en erreur 409 que
 * l'utilisateur ne saurait pas quoi faire de.
 */
export function objetsAAjouter(
  idsChoisis: number[],
  articlesExistants: ArticleDeListe[]
): number[] {
  const deja = new Set(
    articlesExistants.map((article) => article.item?.id).filter((id): id is number => id != null)
  )
  return [...new Set(idsChoisis)].filter((id) => !deja.has(id))
}
