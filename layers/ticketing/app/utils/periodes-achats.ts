/**
 * Découper les achats de billets selon qu'ils précèdent, accompagnent ou suivent l'édition.
 *
 * Trois lectures très différentes se superposent dans ce graphique. Les ventes des mois qui
 * précèdent disent si la communication a porté ; celles des jours de l'événement disent combien
 * de monde s'est décidé sur place ; celles d'après sont presque toujours des régularisations.
 * Les regarder ensemble revient à lire trois phénomènes sur une seule courbe.
 *
 * ⚠️ « Avant » n'a PAS de borne basse. La billetterie ouvre souvent des mois à l'avance, bien
 * avant le montage : borner cette période à la fenêtre de montage viderait le graphique de
 * l'essentiel de ce qu'il montre. La fenêtre de montage y est incluse, puisqu'elle précède
 * l'événement. Symétriquement, « après » englobe le démontage et tout ce qui suit.
 *
 * Les trois périodes sont exhaustives et disjointes : tout instant tombe dans une et une seule.
 */

/** Les trois périodes, dans l'ordre chronologique où l'écran les propose. */
export const PERIODES_DACHAT = ['avant', 'pendant', 'apres'] as const

/** Une période, typée par sa liste : la page n'a alors aucun cast à faire. */
export type PeriodeDachat = (typeof PERIODES_DACHAT)[number]

/** Les bornes de l'édition — celles de l'événement lui-même, montage et démontage exclus. */
export interface BornesDeLEdition {
  debut: string | Date | null | undefined
  fin: string | Date | null | undefined
}

/** Une date lisible, ou `null` — une chaîne vide et une date invalide valent une absence. */
function enDate(valeur: string | Date | null | undefined): Date | null {
  if (valeur === null || valeur === undefined || valeur === '') return null
  const date = valeur instanceof Date ? new Date(valeur.getTime()) : new Date(valeur)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * La période à laquelle appartient un instant, ou `null` si on ne peut pas le dire.
 *
 * Le premier instant de l'édition est « pendant », le dernier n'en est plus : la borne de fin
 * appartient à l'après, exactement comme la fenêtre de démontage qui commence là.
 */
export function periodeDunInstant(
  instant: string | Date | null | undefined,
  bornes: BornesDeLEdition
): PeriodeDachat | null {
  const quand = enDate(instant)
  const debut = enDate(bornes.debut)
  const fin = enDate(bornes.fin)
  if (quand === null || debut === null || fin === null) return null

  if (quand.getTime() < debut.getTime()) return 'avant'
  if (quand.getTime() < fin.getTime()) return 'pendant'
  return 'apres'
}

/**
 * Les rangs des tranches à garder, pour une sélection de périodes.
 *
 * Rend des INDEX et non des valeurs, parce que l'appelant a quatre séries parallèles à découper
 * du même geste : filtrer chacune séparément les désynchroniserait à la première divergence.
 *
 * Quand les bornes de l'édition sont illisibles, tout est gardé. Un graphique complet assorti
 * d'un filtre sans effet se remarque ; un graphique vide, lui, se lit comme « aucune vente ».
 */
export function indicesDansLesPeriodes(
  timestamps: readonly (string | Date | null | undefined)[],
  bornes: BornesDeLEdition,
  periodes: readonly string[]
): number[] {
  const tous = timestamps.map((_, index) => index)
  if (enDate(bornes.debut) === null || enDate(bornes.fin) === null) return tous

  const retenues = new Set(periodes)
  const indices: number[] = []
  timestamps.forEach((instant, index) => {
    const periode = periodeDunInstant(instant, bornes)
    // Une tranche qu'on ne sait pas situer est gardée : mieux vaut un point de trop qu'un chiffre
    // amputé sans que rien ne le dise.
    if (periode === null || retenues.has(periode)) indices.push(index)
  })
  return indices
}

/** Une série découpée sur les rangs retenus, en préservant l'ordre. */
export function serieSurIndices(indices: readonly number[], valeurs: readonly number[]): number[] {
  return indices.map((i) => valeurs[i]).filter((v): v is number => v !== undefined)
}
