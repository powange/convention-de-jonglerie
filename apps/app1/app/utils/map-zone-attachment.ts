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

/** Une entrée de programme, telle qu'un popup la montre. */
export interface EntreeDePopup {
  titre: string
  debut: string
  source: string
  duree?: number | null
}

/** Ce que le composeur ne peut pas deviner : les libellés et le format d'heure de la page. */
export interface LibellesDePopup {
  titreDeSource: (source: string) => string
  formaterHorodatage: (horodatage: string) => string
}

/**
 * L'icône de chaque source. L'ordre des clés est celui des sections.
 *
 * `element` est l'ajout de ce lot : les éléments LIBRES du programme — un repas, une scène
 * ouverte, l'ouverture de l'accueil — se rattachent à une zone ou à un repère comme les
 * spectacles et les ateliers, et n'apparaissaient dans aucun popup.
 */
const ICONE_DE_SOURCE = {
  spectacle: '🎭',
  workshop: '🎓',
  element: '📋',
} as const

/**
 * Les entrées d'un lieu, groupées par source, pour le corps d'un popup.
 *
 * ⚠️ UN COMPOSEUR, PAS TROIS BLOCS. Cette fonction vivait dans `map.vue` et portait DEUX blocs
 * quasi identiques — un pour les spectacles, un pour les ateliers. Ajouter les éléments libres en
 * aurait fait un troisième : trois copies d'une mise en forme, donc trois endroits où corriger le
 * jour où le séparateur change.
 *
 * 📍 Elle est sortie de `map.vue` pour une seconde raison : elle y était intestable. Les popups
 * de cet écran ont déjà connu deux défauts MUETS — un point d'API non public, et une clé de
 * réponse renommée — qui se lisaient tous deux « popup sans spectacle, sans erreur ». Une
 * fonction pure se vérifie ; un morceau de 900 lignes de page, non.
 */
export function buildItemsPopupHtml(
  entrees: readonly EntreeDePopup[],
  libelles: LibellesDePopup
): string {
  let html = ''

  for (const source of Object.keys(ICONE_DE_SOURCE) as (keyof typeof ICONE_DE_SOURCE)[]) {
    const duGroupe = entrees.filter((e) => e.source === source)
    if (duGroupe.length === 0) continue

    const triees = [...duGroupe].sort(
      (a, b) => new Date(a.debut).getTime() - new Date(b.debut).getTime()
    )
    html += '<hr style="margin: 8px 0; border-color: #e5e7eb;"/>'
    html += `<div style="margin-top: 4px;"><strong>${ICONE_DE_SOURCE[source]} ${escapeHtml(
      libelles.titreDeSource(source)
    )}</strong>`
    html += '<div style="margin-top: 4px; font-size: 13px;">'
    for (const entree of triees) {
      html += `<div style="margin-top: 4px;">• ${escapeHtml(entree.titre)} — ${libelles.formaterHorodatage(entree.debut)}`
      if (entree.duree) html += ` (${entree.duree} min)`
      html += '</div>'
    }
    html += '</div></div>'
  }

  return html
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

/**
 * Valeur du choix « aucune zone » dans les sélecteurs.
 *
 * `null` ne convient pas : Nuxt UI le lit comme « rien de sélectionné » plutôt que comme une
 * option, si bien que le choix existait dans la liste sans pouvoir être retenu — un rattachement
 * s'ajoutait donc, mais ne se retirait plus.
 *
 * Zéro n'entre en conflit avec aucun identifiant, ceux-ci commençant à un.
 */
export const NO_ZONE = 0

/** Rattachement enregistré → valeur du sélecteur. */
export function toZoneSelection(zoneId: number | null | undefined): number {
  return zoneId ?? NO_ZONE
}

/** Valeur du sélecteur → rattachement à enregistrer, `null` détachant. */
export function fromZoneSelection(selection: number | null | undefined): number | null {
  return !selection || selection === NO_ZONE ? null : selection
}
