import { PERIODES_DACHAT } from './periodes-achats'

import {
  entiersDepuisUrl,
  entierDepuisUrl,
  requeteAvec,
  selectionDepuisUrl,
  selectionVersUrl,
  valeurDepuisUrl,
} from '~~/shared/utils/filtres-url'

/**
 * Les réglages des graphiques de statistiques, dans l'URL.
 *
 * C'est l'écran qu'on partage le plus volontiers par lien — « regarde les entrées du samedi
 * heure par heure » —, et c'est précisément ce que le lien ne transportait pas : il rendait les
 * sept réglages à leur état d'arrivée, à charge pour le destinataire de refaire la manipulation
 * sur la foi d'une description.
 *
 * Les défauts ne sont pas tous constants — les types de présence dépendent de l'activation des
 * artistes sur l'édition —, d'où le défaut passé en paramètre plutôt que figé ici.
 */

/** Les périodes de l'événement qu'un graphique peut montrer. */
export const PERIODES_DE_STATS = ['setup', 'event', 'teardown'] as const

/** Les types de présence, dans l'ordre où l'écran les propose. */
export const TYPES_DE_PRESENCE_STATS = [
  'participants',
  'volunteers',
  'artists',
  'organizers',
  'others',
] as const

/** Les types d'achat que le second graphique distingue. */
export const TYPES_DACHAT_STATS = ['participants', 'others'] as const

/** Les granularités proposées, en minutes. */
export const GRANULARITES_DE_STATS = [30, 60, 120, 360, 720, 1440, 10080, 43200] as const

/** Ce que la vue des provenances montre : les articles, ou les commandes. */
export const VUES_DE_PROVENANCE = ['items', 'orders'] as const

/** La vue des provenances, typée par sa liste : la page n'a alors aucun cast à faire. */
export type VueDeProvenance = (typeof VUES_DE_PROVENANCE)[number]

/** Une heure : le pas d'arrivée du graphique des validations d'entrée. */
export const GRANULARITE_STATS_PAR_DEFAUT = 60

/** Un jour : le pas d'arrivée du graphique des achats, bien plus étalés dans le temps. */
export const GRANULARITE_ACHATS_PAR_DEFAUT = 1440

/** Les réglages, tels que l'écran les manipule. */
export interface ReglagesDeStats {
  types: string[]
  periodes: string[]
  granularite: number
  typesDachat: string[]
  granulariteDesAchats: number
  tarifs: number[]
  vue: VueDeProvenance
  /**
   * Les périodes retenues pour le graphique des achats.
   *
   * Distinctes de `periodes`, qui découpe les validations d'entrée en montage / événement /
   * démontage. Les achats se lisent sur d'autres bornes — « avant » y remonte à l'ouverture de la
   * billetterie, des mois avant le montage — et les deux graphiques se règlent séparément.
   */
  periodesDachat: string[]
  /**
   * L'édition passée à laquelle on se compare, ou `null` quand on ne compare pas.
   *
   * `null` est le défaut et il ne s'écrit pas dans l'URL : un écran sans comparaison doit avoir
   * exactement l'adresse qu'il avait avant que cette possibilité existe.
   */
  comparaison: number | null
}

/**
 * Les réglages que l'URL décrit, ramenés aux défauts pour tout ce qu'elle ne dit pas.
 *
 * @param typesParDefaut les types de présence cochés d'office, artistes compris ou non selon
 *                       que l'édition les active.
 */
export function reglagesDepuisUrl(
  query: Record<string, unknown>,
  typesParDefaut: readonly string[]
): ReglagesDeStats {
  return {
    types: selectionDepuisUrl(query.types, typesParDefaut),
    periodes: selectionDepuisUrl(query.periods, PERIODES_DE_STATS),
    granularite: granulariteDepuisUrl(query.grain, GRANULARITE_STATS_PAR_DEFAUT),
    typesDachat: selectionDepuisUrl(query.buyTypes, TYPES_DACHAT_STATS),
    granulariteDesAchats: granulariteDepuisUrl(query.buyGrain, GRANULARITE_ACHATS_PAR_DEFAUT),
    // Aucun tarif coché veut dire « tous » : la liste vide est ici le défaut, sans troisième état
    // à distinguer, et se lit donc directement.
    tarifs: entiersDepuisUrl(query.tiers),
    vue: valeurDepuisUrl(query.view, VUES_DE_PROVENANCE, VUES_DE_PROVENANCE[0]),
    periodesDachat: selectionDepuisUrl(query.buyPeriods, PERIODES_DACHAT),
    comparaison: comparaisonDepuisUrl(query.compare),
  }
}

/**
 * L'édition de comparaison lue dans l'URL, ou `null`.
 *
 * Un identifiant qui n'est pas un entier positif est traité comme une absence plutôt que comme
 * une erreur : une URL partagée puis tronquée doit rendre un écran normal, pas un écran cassé.
 * Que l'édition existe et soit lisible est vérifié par le serveur, pas ici.
 */
function comparaisonDepuisUrl(brut: unknown): number | null {
  const valeur = entierDepuisUrl(brut, 0)
  return Number.isInteger(valeur) && valeur > 0 ? valeur : null
}

/**
 * Une granularité de la liste proposée, ou le défaut.
 *
 * Une valeur libre passerait telle quelle au graphique, qui la découperait en tranches qu'aucun
 * sélecteur ne peut ensuite afficher ni corriger.
 */
function granulariteDepuisUrl(brut: unknown, defaut: number): number {
  const valeur = entierDepuisUrl(brut, defaut)
  return (GRANULARITES_DE_STATS as readonly number[]).includes(valeur) ? valeur : defaut
}

/** La query reflétant les réglages, en préservant les autres paramètres déjà présents. */
export function requeteStats(
  queryActuelle: Record<string, unknown>,
  reglages: ReglagesDeStats,
  typesParDefaut: readonly string[]
): Record<string, string | string[]> {
  return requeteAvec(queryActuelle, {
    types: selectionVersUrl(reglages.types, typesParDefaut),
    periods: selectionVersUrl(reglages.periodes, PERIODES_DE_STATS),
    grain:
      reglages.granularite === GRANULARITE_STATS_PAR_DEFAUT ? '' : String(reglages.granularite),
    buyTypes: selectionVersUrl(reglages.typesDachat, TYPES_DACHAT_STATS),
    buyGrain:
      reglages.granulariteDesAchats === GRANULARITE_ACHATS_PAR_DEFAUT
        ? ''
        : String(reglages.granulariteDesAchats),
    tiers: reglages.tarifs.join(','),
    view: reglages.vue === VUES_DE_PROVENANCE[0] ? '' : reglages.vue,
    buyPeriods: selectionVersUrl(reglages.periodesDachat, PERIODES_DACHAT),
    // Vide quand on ne compare pas : le paramètre disparaît de l'URL au lieu d'y écrire « null ».
    compare: reglages.comparaison === null ? '' : String(reglages.comparaison),
  })
}
