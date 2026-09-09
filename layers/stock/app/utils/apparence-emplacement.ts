import { getZoneTypeColor, getZoneTypeIcon } from '~~/shared/utils/zone-types'

/**
 * Comment montrer l'emplacement de rangement d'un matériel.
 *
 * Un emplacement se dit de deux façons qui se complètent : un lieu de la carte du site — zone ou
 * marqueur —, et une précision écrite à la main. « Zone technique » situe, « troisième étagère à
 * gauche » retrouve. Les deux peuvent coexister, et faire primer l'un sur l'autre revenait à
 * cacher une information saisie exprès.
 *
 * Les lieux de la carte portent la couleur et l'icône de leur type, celles-là mêmes que la carte
 * affiche : les reprendre ici évite de retraduire un nom de lieu en repère visuel d'un écran à
 * l'autre. Auparavant une zone n'était qu'un point coloré et un marqueur un drapeau générique —
 * rien ne distinguait une scène d'un point d'eau.
 */

/** Une zone ou un marqueur, tels que l'API les rend. */
interface LieuCarte {
  name: string
  color?: string | null
  zoneTypes?: unknown
  markerTypes?: unknown
}

/** Un lieu de la carte, prêt à dessiner. */
export interface LieuAffichable {
  nom: string
  icone: string
  couleur: string
}

/** Ce qu'il y a à montrer d'un emplacement de rangement. */
export interface EmplacementRangement {
  /** Le lieu posé sur la carte, ou `null` s'il n'y en a pas. */
  carte: LieuAffichable | null
  /** La précision écrite à la main, ou `null` si elle est vide. */
  texte: string | null
}

/** Le premier type déclaré, ou `OTHER` faute de mieux. */
function premierType(types: unknown): string {
  return Array.isArray(types) && typeof types[0] === 'string' ? types[0] : 'OTHER'
}

/**
 * L'emplacement de rangement, ou `null` quand rien n'est renseigné.
 *
 * La zone prime sur le marqueur — un matériel n'est posé qu'à un endroit de la carte —, mais le
 * texte libre coexiste avec l'un comme avec l'autre.
 *
 * La couleur d'une zone est la sienne ; celle d'un marqueur peut être personnalisée, sinon elle
 * découle de son type — exactement la règle du sélecteur d'emplacement.
 */
export function apparenceEmplacement(
  zone: LieuCarte | null | undefined,
  marker: LieuCarte | null | undefined,
  texteLibre?: string | null
): EmplacementRangement | null {
  let carte: LieuAffichable | null = null

  if (zone) {
    const type = premierType(zone.zoneTypes)
    carte = {
      nom: zone.name,
      icone: getZoneTypeIcon(type),
      couleur: zone.color || getZoneTypeColor(type),
    }
  } else if (marker) {
    const type = premierType(marker.markerTypes)
    carte = {
      nom: marker.name,
      icone: getZoneTypeIcon(type),
      couleur: marker.color || getZoneTypeColor(type),
    }
  }

  const texte = texteLibre?.trim() || null
  if (!carte && !texte) return null

  return { carte, texte }
}

/**
 * Le libellé sous lequel trier un emplacement.
 *
 * Le lieu de la carte d'abord : c'est lui qui situe, et trier sur la précision écrite à la main
 * disperserait les matériels rangés au même endroit.
 */
export function libelleEmplacement(emplacement: EmplacementRangement | null): string {
  if (!emplacement) return ''
  return emplacement.carte?.nom || emplacement.texte || ''
}
