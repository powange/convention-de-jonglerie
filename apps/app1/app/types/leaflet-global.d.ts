import type {
  Map as LeafletMap,
  Polygon,
  LatLng,
  DivIcon,
  TileLayer,
  LatLngExpression,
} from 'leaflet'

/**
 * Types pour Leaflet.Editable
 * @see https://github.com/Leaflet/Leaflet.Editable
 */

// Options pour le plugin Editable
interface EditableMapOptions {
  editable?: boolean
  editOptions?: EditOptions
}

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

// Interface pour un polygone éditable
interface EditablePolygon extends Polygon {
  enableEdit(): void
  disableEdit(): void
  toggleEdit(): void
  editEnabled(): boolean
  on(
    event:
      | 'editable:drawing:end'
      | 'editable:vertex:dragend'
      | 'editable:vertex:deleted'
      | 'editable:editing',
    callback: () => void
  ): this
}

// Extension de l'interface Map de Leaflet pour inclure editTools
interface EditableMap extends LeafletMap {
  editTools?: EditTools
}

// Déclaration globale pour window.L
declare global {
  interface Window {
    L: typeof import('leaflet') & {
      Editable?: new (map: LeafletMap, options?: EditOptions) => EditTools
      map(
        element: HTMLElement | string,
        options?: import('leaflet').MapOptions & EditableMapOptions
      ): EditableMap
      tileLayer(urlTemplate: string, options?: import('leaflet').TileLayerOptions): TileLayer
      polygon(
        latlngs: LatLngExpression[] | LatLngExpression[][],
        options?: PolygonOptions
      ): EditablePolygon
      marker(
        latlng: LatLngExpression,
        options?: import('leaflet').MarkerOptions
      ): import('leaflet').Marker
      divIcon(options?: import('leaflet').DivIconOptions): DivIcon
      latLngBounds(latlngs: LatLngExpression[]): import('leaflet').LatLngBounds
    }
  }
}

export type { EditableMap, EditablePolygon, EditTools, PolygonOptions, MarkerOptions }
