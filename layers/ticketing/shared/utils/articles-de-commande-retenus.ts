/**
 * Quels articles d'une commande un filtre retient VRAIMENT.
 *
 * La liste des commandes filtre par `items: { some: … }` : elle retient les commandes qui portent
 * au moins un article correspondant. C'est le bon critère pour choisir les COMMANDES à afficher,
 * et c'est le mauvais pour compter les ARTICLES — une commande retenue arrive avec la totalité des
 * siens, y compris ceux d'un tarif qu'on n'a pas demandé.
 *
 * Le bandeau annonçait donc « 1 commande, 2 billets » là où un seul billet portait le tarif
 * choisi. Un chiffre faux, plausible, et que rien ne signalait : l'écart ne se voit qu'en
 * dépliant la commande et en comparant à la main.
 *
 * Cette règle vit ici, hors du gestionnaire, pour deux raisons. Elle doit donner exactement le
 * même verdict que les conditions Prisma de la requête — les deux se lisent donc côte à côte,
 * testées. Et le CLIENT s'en sert aussi, pour griser les articles qu'un filtre écarte : la liste
 * montre alors la commande entière, sans faire croire que tout y répond au filtre.
 *
 * ⚠️ Ce fichier ne doit rien importer : il est chargé tel quel par les tests unitaires, hors Nuxt.
 */

/** Les filtres qui portent sur un ARTICLE, et non sur la commande qui le contient. */
export interface FiltresDArticles {
  /** Les tarifs retenus. Liste vide = aucun filtre de tarif. */
  tierIds?: readonly number[]
  /** `validated`, `not_validated`, ou rien. */
  entryStatus?: string | null
  /** Les options retenues, en OU : un article suffit à en porter une. */
  optionIds?: readonly number[]
  /** Les natures d'article retenues — Participant, Donation, Membership, Payment. */
  itemTypes?: readonly string[]
}

/** Un article, réduit à ce que les filtres regardent. */
export interface ArticleAFiltrer {
  tierId?: number | null
  entryValidated?: boolean | null
  selectedOptions?: ReadonlyArray<{ optionId: number }> | null
  type?: string | null
}

/**
 * Un filtre d'article est-il seulement posé ?
 *
 * Sans lui, rien ne change : tous les articles d'une commande retenue lui appartiennent
 * pleinement, et les totaux restent ceux qu'ils ont toujours été.
 */
export function filtresDArticlesActifs(filtres: FiltresDArticles): boolean {
  return (
    (filtres.tierIds?.length ?? 0) > 0 ||
    filtres.entryStatus === 'validated' ||
    filtres.entryStatus === 'not_validated' ||
    (filtres.optionIds?.length ?? 0) > 0 ||
    (filtres.itemTypes?.length ?? 0) > 0
  )
}

/**
 * Cet article répond-il aux filtres ?
 *
 * Les critères se combinent par ET, exactement comme le `AND` de la requête. Chaque branche
 * reproduit une condition Prisma, et c'est là le seul point qui compte : une divergence ferait
 * griser à l'écran un article que la requête a pourtant retenu, ou l'inverse.
 */
export function articleRetenu(article: ArticleAFiltrer, filtres: FiltresDArticles): boolean {
  // `tierId: { in: [...] }` — un article sans tarif n'est jamais dans la liste.
  if ((filtres.tierIds?.length ?? 0) > 0) {
    if (article.tierId == null) return false
    if (!filtres.tierIds!.includes(article.tierId)) return false
  }

  // `entryValidated: true` d'un côté, `{ not: true }` de l'autre. Un `null` n'est PAS `true` :
  // il tombe donc du côté « non validée », comme en base.
  if (filtres.entryStatus === 'validated' && article.entryValidated !== true) return false
  if (filtres.entryStatus === 'not_validated' && article.entryValidated === true) return false

  // `selectedOptions: { some: { optionId: { in: [...] } } }` — au moins une, pas toutes.
  if ((filtres.optionIds?.length ?? 0) > 0) {
    const options = article.selectedOptions ?? []
    if (!options.some((o) => filtres.optionIds!.includes(o.optionId))) return false
  }

  // `type: { in: [...] }`
  if ((filtres.itemTypes?.length ?? 0) > 0) {
    if (article.type == null) return false
    if (!filtres.itemTypes!.includes(article.type)) return false
  }

  return true
}

/** Les articles d'une commande que les filtres retiennent, dans l'ordre. */
export function articlesRetenus<T extends ArticleAFiltrer>(
  articles: readonly T[],
  filtres: FiltresDArticles
): T[] {
  if (!filtresDArticlesActifs(filtres)) return [...articles]
  return articles.filter((article) => articleRetenu(article, filtres))
}
