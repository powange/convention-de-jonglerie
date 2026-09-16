import {
  entierDepuisUrl,
  requeteAvec,
  texteDepuisUrl,
  valeurDepuisUrl,
} from '~~/shared/utils/filtres-url'

/**
 * Les filtres de la liste des repas, dans l'URL.
 *
 * C'est le tableau le plus long de la gestion — plusieurs centaines de lignes pour une édition
 * ordinaire — et celui qu'on filtre le plus finement : la phase, le type de personne, le type de
 * repas, le jour. Sans ces filtres dans l'URL, un rechargement, un retour depuis une autre page
 * ou un lien envoyé à quelqu'un repartaient de « tout », et il fallait reposer les quatre
 * sélecteurs à la main.
 *
 * `page` en fait partie : les filtres seuls dans l'URL ramènent à la première page, ce qui vide
 * la moitié de l'intérêt du lien quand on est au bout d'une longue liste.
 */

/** L'état d'arrivée d'un sélecteur : aucun filtre. */
export const SANS_FILTRE = 'all'

/** Les phases qu'un filtre peut viser. */
export const PHASES_FILTRABLES = [SANS_FILTRE, 'SETUP', 'EVENT', 'TEARDOWN'] as const

/** Les types de personne qu'un filtre peut viser. */
export const TYPES_DE_PERSONNE_FILTRABLES = [
  SANS_FILTRE,
  'participant',
  'volunteer',
  'artist',
  'organizer',
] as const

/** Les types de repas qu'un filtre peut viser. */
export const TYPES_DE_REPAS_FILTRABLES = [SANS_FILTRE, 'BREAKFAST', 'LUNCH', 'DINNER'] as const

/** Les filtres, tels que l'écran les manipule. */
export interface FiltresDeListeDeRepas {
  recherche: string
  phase: string
  typeDePersonne: string
  typeDeRepas: string
  date: string
  page: number
}

/** Les filtres que l'URL décrit, ramenés aux défauts pour tout ce qu'elle ne dit pas. */
export function filtresDepuisUrl(query: Record<string, unknown>): FiltresDeListeDeRepas {
  return {
    recherche: texteDepuisUrl(query.search),
    phase: valeurDepuisUrl(query.phase, PHASES_FILTRABLES, SANS_FILTRE),
    typeDePersonne: valeurDepuisUrl(query.type, TYPES_DE_PERSONNE_FILTRABLES, SANS_FILTRE),
    typeDeRepas: valeurDepuisUrl(query.meal, TYPES_DE_REPAS_FILTRABLES, SANS_FILTRE),
    // La date n'a pas de liste fermée : elle dépend des jours que le serveur rend pour cette
    // édition. Elle est donc lue telle quelle, puis confrontée à ces jours par `dateConnue`.
    date: texteDepuisUrl(query.date) || SANS_FILTRE,
    page: entierDepuisUrl(query.page, 1),
  }
}

/**
 * La date, si elle fait partie des jours que le serveur a rendus.
 *
 * Les jours n'arrivent qu'avec la première réponse : d'ici là, on ne peut pas dire si la date de
 * l'URL est valable, et l'écarter par précaution effacerait un filtre parfaitement bon. On ne
 * tranche donc qu'une fois la liste connue — et une date qui n'y est pas retombe sur « tous les
 * jours », plutôt que de laisser un tableau vide sans cause visible.
 */
export function dateConnue(date: string, disponibles: readonly string[]): string {
  if (date === SANS_FILTRE) return SANS_FILTRE
  return disponibles.includes(date) ? date : SANS_FILTRE
}

/** La query reflétant les filtres, en préservant les autres paramètres déjà présents. */
export function requeteListeDeRepas(
  queryActuelle: Record<string, unknown>,
  filtres: FiltresDeListeDeRepas
): Record<string, string | string[]> {
  return requeteAvec(queryActuelle, {
    search: filtres.recherche,
    phase: filtres.phase === SANS_FILTRE ? '' : filtres.phase,
    type: filtres.typeDePersonne === SANS_FILTRE ? '' : filtres.typeDePersonne,
    meal: filtres.typeDeRepas === SANS_FILTRE ? '' : filtres.typeDeRepas,
    date: filtres.date === SANS_FILTRE ? '' : filtres.date,
    // La première page est l'état d'arrivée : l'écrire allongerait l'URL sans rien dire.
    page: filtres.page > 1 ? String(filtres.page) : '',
  })
}
