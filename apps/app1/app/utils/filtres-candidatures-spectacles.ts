import { entierDepuisUrl, requeteAvec, texteDepuisUrl } from '~~/shared/utils/filtres-url'

/**
 * Les filtres des candidatures à un appel à spectacles, dans l'URL.
 *
 * C'est l'écran où l'absence coûtait le plus cher : on en sort pour lire une candidature, on y
 * revient, et le statut, la recherche et la page étaient perdus à chaque aller-retour. Sur un
 * appel qui en reçoit quarante, cela fait quarante fois la même manipulation.
 *
 * `page` est donc conservée au même titre que les filtres : les filtres seuls ramèneraient à la
 * première page, ce qui ne règle que la moitié du problème.
 */

/** Les statuts qu'un filtre peut viser. */
export const STATUTS_DE_CANDIDATURE = ['PENDING', 'ACCEPTED', 'REJECTED'] as const

/** Les filtres, tels que l'écran les manipule. `null` en statut veut dire « tous ». */
export interface FiltresDeCandidaturesDeSpectacles {
  statut: string | null
  recherche: string
  page: number
}

/**
 * Les filtres que l'URL décrit, ramenés aux défauts pour tout ce qu'elle ne dit pas.
 *
 * Le sélecteur de statut porte `null` pour « tous », et non une chaîne : un statut inconnu y
 * retombe, faute de quoi l'écran filtrerait sur une valeur qu'il ne peut même pas afficher.
 */
export function filtresDeSpectaclesDepuisUrl(
  query: Record<string, unknown>
): FiltresDeCandidaturesDeSpectacles {
  const statut = texteDepuisUrl(query.status)

  return {
    statut: (STATUTS_DE_CANDIDATURE as readonly string[]).includes(statut) ? statut : null,
    recherche: texteDepuisUrl(query.search),
    page: entierDepuisUrl(query.page, 1),
  }
}

/** La query reflétant les filtres, en préservant les autres paramètres déjà présents. */
export function requeteCandidaturesDeSpectacles(
  queryActuelle: Record<string, unknown>,
  filtres: FiltresDeCandidaturesDeSpectacles
): Record<string, string | string[]> {
  return requeteAvec(queryActuelle, {
    status: filtres.statut ?? '',
    search: filtres.recherche,
    // La première page est l'état d'arrivée : l'écrire allongerait l'URL sans rien dire.
    page: filtres.page > 1 ? String(filtres.page) : '',
  })
}
