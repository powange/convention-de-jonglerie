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

/** Le minimum qu'une ligne de légende doit exposer pour être regroupée. */
export interface GroupableLegendItem {
  id: number
  name: string
  types: string[]
  itemType: 'zone' | 'marker'
  zoneId: number | null
}

/** Une zone en tête et ses entrées en retrait, ou un élément seul. */
export interface LegendGroup<T> {
  key: string
  name: string
  rows: T[]
}

/**
 * Regroupe les lignes de légende : chaque zone emmène ses entrées, les autres restent seules.
 *
 * Deux cas méritent attention. Une entrée n'apparaît jamais deux fois — elle vit sous sa zone,
 * pas à la racine. Et une entrée dont la zone est absente de la liste est remontée à la racine
 * plutôt que de disparaître sans un mot : c'est ce qui arriverait si le rattachement pointait
 * vers une zone que la liste ne contient pas.
 */
export function groupLegendItems<T extends GroupableLegendItem>(
  items: readonly T[]
): LegendGroup<T>[] {
  const attachedByZone = new Map<number, T[]>()
  for (const item of items) {
    if (item.itemType !== 'marker' || item.zoneId === null) continue
    const list = attachedByZone.get(item.zoneId)
    if (list) list.push(item)
    else attachedByZone.set(item.zoneId, [item])
  }

  const zoneIds = new Set(items.filter((i) => i.itemType === 'zone').map((i) => i.id))
  const groups: LegendGroup<T>[] = []

  for (const item of items) {
    const isAttached = item.itemType === 'marker' && item.zoneId !== null
    if (isAttached && zoneIds.has(item.zoneId as number)) continue
    const children = item.itemType === 'zone' ? (attachedByZone.get(item.id) ?? []) : []
    groups.push({ key: `${item.itemType}-${item.id}`, name: item.name, rows: [item, ...children] })
  }

  return groups.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}

/**
 * Le groupe est l'unité du filtre : une zone retenue emmène ses entrées, et une entrée retenue
 * fait apparaître sa zone. Filtrer ligne à ligne détacherait visuellement ce qu'on vient de
 * regrouper.
 */
export function filterLegendGroups<T extends GroupableLegendItem>(
  groups: LegendGroup<T>[],
  activeFilters: ReadonlySet<string>
): LegendGroup<T>[] {
  if (activeFilters.size === 0) return groups
  return groups.filter((group) =>
    group.rows.some((row) => row.types.some((t) => activeFilters.has(t)))
  )
}
