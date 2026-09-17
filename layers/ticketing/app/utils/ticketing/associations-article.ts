/**
 * Ce qu'une suppression d'article à remettre détacherait, table par table.
 *
 * Forme rendue par `GET /api/editions/[id]/ticketing/handout-items`, identique à
 * `AssociationsDunArticle` côté serveur.
 */
export interface AssociationsDunArticle {
  tarifs: number
  options: number
  champsPersonnalises: number
  spectacles: number
  artistes: number
  equipesBenevoles: number
  organisateurs: number
  repas: number
}

/**
 * L'ordre d'énumération, et la clé de traduction de chaque catégorie.
 *
 * Il est fixe et voulu : on lit d'abord ce qui touche la vente (tarifs, options, champs), puis
 * les populations présentes sur place. Une liste dont l'ordre suit celui de l'objet JSON
 * changerait au gré des sérialisations.
 */
export const CATEGORIES_ASSOCIATION = [
  'tarifs',
  'options',
  'champsPersonnalises',
  'spectacles',
  'artistes',
  'equipesBenevoles',
  'organisateurs',
  'repas',
] as const satisfies ReadonlyArray<keyof AssociationsDunArticle>

/** Traducteur avec pluriel, tel que le fournit `useI18n` : `t(clé, { count }, count)`. */
export type TraducteurDeCompte = (cle: string, count: number) => string

/**
 * Énumère les associations d'un article en une phrase lisible : « 3 tarifs, 1 option et 2 équipes ».
 *
 * Rend une chaîne vide quand l'article n'est associé à rien — l'appelant dit alors autre chose
 * plutôt que d'annoncer une liste vide.
 *
 * Les catégories à zéro sont écartées : « 3 tarifs, 0 option et 0 spectacle » se lit plus mal
 * que le chiffre qui compte, et la confirmation doit tenir en un coup d'œil.
 *
 * La coordination du dernier terme est passée en paramètre plutôt que codée à « et » : la phrase
 * traverse treize langues, et c'est le seul endroit de la liste qui ne se réduit pas à une
 * virgule.
 */
export function enumererLesAssociations(
  associations: AssociationsDunArticle | undefined | null,
  t: TraducteurDeCompte,
  coordination: string
): string {
  if (!associations) return ''

  const termes = CATEGORIES_ASSOCIATION.filter((categorie) => associations[categorie] > 0).map(
    (categorie) => t(`ticketing.handout_items.associations.${categorie}`, associations[categorie])
  )

  if (termes.length === 0) return ''
  if (termes.length === 1) return termes[0]!

  const dernier = termes[termes.length - 1]!
  return `${termes.slice(0, -1).join(', ')} ${coordination} ${dernier}`
}
