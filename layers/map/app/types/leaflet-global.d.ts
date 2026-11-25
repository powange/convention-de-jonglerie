import type { Map as LeafletMap, Polygon, LatLng, DivIcon } from 'leaflet'

/**
 * Types pour Leaflet.Editable
 * @see https://github.com/Leaflet/Leaflet.Editable
 */

// Options pour le plugin Editable
interface EditOptions {
  drawingCSSClass?: string
  skipMiddleMarkers?: boolean
}

// Interface pour les outils d'édition (editTools)
interface EditTools {
  startPolygon(latlng?: LatLng, options?: PolygonOptions): EditablePolygon
  startPolyline(latlng?: LatLng, options?: PolylineOptions): any
  startMarker(latlng?: LatLng, options?: MarkerOptions): any
  startRectangle(latlng?: LatLng, options?: RectangleOptions): any
  startCircle(latlng?: LatLng, options?: CircleOptions): any
  stopDrawing(): void
  commitDrawing(): void
}

interface PolygonOptions {
  color?: string
  fillColor?: string
  fillOpacity?: number
  weight?: number
}

interface PolylineOptions {
  color?: string
  weight?: number
}

interface MarkerOptions {
  icon?: DivIcon
  draggable?: boolean
}

type RectangleOptions = PolygonOptions

interface CircleOptions extends PolygonOptions {
  radius?: number
}

/**
 * Un polygone auquel Leaflet.Editable a ajouté ses méthodes d'édition.
 *
 * Pas de surcharge de `on` ici : la restreindre aux seuls événements d'édition rendait le
 * polygone inassignable partout où Leaflet attend une `Layer` — `removeLayer` en tête. La
 * signature de `Evented.on` accepte déjà ces noms d'événements.
 */
interface EditablePolygon extends Polygon {
  enableEdit(): void
  disableEdit(): void
  toggleEdit(): void
  editEnabled(): boolean
}

// Extension de l'interface Map de Leaflet pour inclure editTools
interface EditableMap extends LeafletMap {
  editTools?: EditTools
}

/**
 * Ce que le greffon Leaflet.Editable ajoute aux types de Leaflet lui-même : l'option
 * `editable` à la création de la carte, et les outils d'édition sur l'instance.
 */
declare module 'leaflet' {
  interface MapOptions {
    editable?: boolean
    editOptions?: EditOptions
  }
  interface Map {
    editTools?: EditTools
  }
}

// Déclaration globale pour window.L
declare global {
  interface Window {
    // Leaflet est chargé par CDN : seul l'ajout du greffon Editable est décrit ici, le reste
    // vient de `@types/leaflet`.
    L: typeof import('leaflet') & {
      Editable?: new (map: LeafletMap, options?: EditOptions) => EditTools
    }
  }
}

export type { EditableMap, EditablePolygon, EditTools, PolygonOptions, MarkerOptions }
