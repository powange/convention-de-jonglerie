/**
 * Rattachement d'un marqueur à une zone : une salle et son entrée.
 *
 * Le modèle garde deux enregistrements — le marqueur reste un point de repère à part entière,
 * avec son nom, son type et sa couleur. L'unité est une affaire d'affichage : les popups se
 * citent mutuellement, et l'itinéraire d'une zone vise son entrée plutôt qu'un centre calculé
 * qui, sur une forme concave, tombe hors du bâtiment.
 */

import { escapeHtml } from './mapMarkers'

/** Le minimum dont ces fonctions ont besoin — les composables en fournissent davantage. */
export interface AttachableMarker {
  id: number
  name: string
  latitude: number
  longitude: number
  zoneId: number | null
}

/** Regroupe les marqueurs par zone de rattachement. Les marqueurs autonomes sont écartés. */
export function groupMarkersByZone<T extends AttachableMarker>(
  markers: readonly T[]
): Map<number, T[]> {
  const byZone = new Map<number, T[]>()
  for (const marker of markers) {
    if (marker.zoneId === null || marker.zoneId === undefined) continue
    const list = byZone.get(marker.zoneId)
    if (list) list.push(marker)
    else byZone.set(marker.zoneId, [marker])
  }
  return byZone
}

/**
 * Destination d'itinéraire d'une zone : sa première entrée, ou `null` pour garder le centre.
 *
 * L'ordre d'affichage tranche quand il y en a plusieurs — c'est celui que l'organisateur a
 * choisi dans la liste, donc l'entrée principale s'il l'a rangée en tête.
 */
export function zoneNavigationTarget<T extends AttachableMarker & { order?: number }>(
  attached: T[] | undefined
): [number, number] | null {
  if (!attached || attached.length === 0) return null
  const first = [...attached].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0]!
  return [first.latitude, first.longitude]
}

/** « Entrées : Entrée principale, Accès PMR », pour le popup de la zone. */
export function buildZoneAttachmentHtml(
  attached: AttachableMarker[] | undefined,
  label: string
): string {
  if (!attached || attached.length === 0) return ''
  const names = attached.map((marker) => escapeHtml(marker.name)).join(', ')
  return `<div style="margin-top:4px;font-size:12px;color:#6b7280">${escapeHtml(label)} ${names}</div>`
}

/** « Entrée de : Salle A », pour le popup du marqueur. */
export function buildMarkerAttachmentHtml(zoneName: string | undefined, label: string): string {
  if (!zoneName) return ''
  return `<div style="margin-top:4px;font-size:12px;color:#6b7280">${escapeHtml(label)} ${escapeHtml(zoneName)}</div>`
}
