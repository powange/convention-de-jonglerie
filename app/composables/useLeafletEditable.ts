import type { EditableMap, EditablePolygon, EditTools } from '~/types/leaflet-global'
import { escapeHtml, escapeHtmlWithNewlines } from '~/utils/mapMarkers'

import type { Marker, LatLngExpression, TileLayer, LeafletMouseEvent } from 'leaflet'
import type { Ref } from 'vue'

import {
  getZoneTypeColor,
  getZoneTypeSvgIcon,
  type EditionZoneType,
} from '~~/shared/utils/zone-types'

export interface EditionZoneData {
  id?: number
  name: string
  description?: string | null
  color: string
  coordinates: [number, number][]
  zoneTypes: string[]
  order?: number
}

export interface EditionMarkerData {
  id?: number
  name: string
  description?: string | null
  latitude: number
  longitude: number
  markerTypes: string[]
  color?: string | null
  order?: number
}

export interface PopupLabels {
  navigate?: string
  edit?: string
  delete?: string
}

export interface UseLeafletEditableOptions {
  center?: LatLngExpression
  zoom?: number
  editable?: boolean
  typeLabel?: (type: string) => string
  popupLabels?: PopupLabels
  onPolygonCreated?: (coordinates: [number, number][]) => void
  onPolygonEdited?: (zoneId: number, coordinates: [number, number][]) => void
  onMarkerCreated?: (latitude: number, longitude: number) => void
  onMarkerMoved?: (markerId: number, latitude: number, longitude: number) => void
  onEditRequest?: (type: 'zone' | 'marker', id: number) => void
  onDeleteRequest?: (type: 'zone' | 'marker', id: number) => void
}

// Note: Les icônes SVG et couleurs sont centralisées dans shared/utils/zone-types.ts (auto-importé)
// Note: Les types globaux pour Leaflet sont définis dans ~/types/leaflet-global.d.ts

export const useLeafletEditable = (
  mapContainer: Ref<HTMLElement | null>,
  options: UseLeafletEditableOptions = {}
) => {
  const {
    center = [46.603354, 1.888334],
    zoom = 6,
    editable = false,
    typeLabel,
    popupLabels = {},
    onEditRequest,
    onDeleteRequest,
    onPolygonCreated,
    onPolygonEdited,
    onMarkerCreated,
    onMarkerMoved,
  } = options

  // shallowRef pour les objets Leaflet : empêche Vue de créer des Proxy réactifs
  // sur les instances Leaflet, ce qui interfère avec le positionnement des marqueurs
  // pendant le zoom/pan (les propriétés internes de Leaflet changent constamment)
  const map = shallowRef<EditableMap | null>(null)
  const tileLayerRef = shallowRef<TileLayer | null>(null)
  const polygons = shallowRef<Map<number, EditablePolygon>>(new Map())
  const zoneIconMarkers = shallowRef<Map<number, Marker>>(new Map())
  const leafletMarkers = shallowRef<Map<number, Marker>>(new Map())
  const isLoading = ref(true)
  const error = ref<string | null>(null)
  const isDrawing = ref(false)
  const isPlacingMarker = ref(false)
  // Stockage des données de popup pour pouvoir les reconstruire avec du contenu supplémentaire
  const popupBaseData = new Map<
    string,
    { name: string; description?: string | null; types?: string[]; coords?: [number, number] }
  >()
  const popupExtraContent = new Map<string, string>()
  const currentDrawingPolygon = shallowRef<EditablePolygon | null>(null)
  // Référence locale pour le nettoyage (au cas où whenReady n'a pas encore été appelé)
  let leafletMapInstance: EditableMap | null = null
  // Référence pour le handler de clic lors du placement de marqueur
  let markerPlacementHandler: ((e: LeafletMouseEvent) => void) | null = null
  // Référence pour le handler de délégation d'événements (popups)
  let popupActionHandler: ((e: MouseEvent) => void) | null = null

  // Sanitise une couleur pour éviter l'injection CSS (n'accepte que les couleurs hex)
  const sanitizeColor = (color: string): string => {
    return /^#[0-9a-fA-F]{3,6}$/.test(color) ? color : '#6b7280'
  }

  const loadLeaflet = async () => {
    try {
      isLoading.value = true

      // Vérifier si Leaflet est déjà chargé
      if (typeof window !== 'undefined' && window.L) {
        return window.L
      }

      // Charger dynamiquement Leaflet CSS
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
        link.crossOrigin = ''
        document.head.appendChild(link)
      }

      // Charger dynamiquement Leaflet JS
      return new Promise((resolve, reject) => {
        if (window.L) {
          resolve(window.L)
          return
        }

        const script = document.createElement('script')
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
        script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo='
        script.crossOrigin = ''
        script.async = true

        script.onload = () => {
          if (window.L) {
            resolve(window.L)
          } else {
            reject(new Error('Leaflet failed to load'))
          }
        }

        script.onerror = () => {
          reject(new Error('Failed to load Leaflet script'))
        }

        document.head.appendChild(script)
      })
    } catch (err) {
      error.value = 'Erreur lors du chargement de la carte'
      console.error('Error loading Leaflet:', err)
      throw err
    }
  }

  const loadLeafletEditable = async () => {
    return new Promise<void>((resolve, reject) => {
      // Vérifier si déjà chargé
      if (window.L && window.L.Editable) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet-editable@1.2.0/src/Leaflet.Editable.js'
      script.async = true

      script.onload = () => {
        if (window.L && window.L.Editable) {
          resolve()
        } else {
          reject(new Error('Leaflet.Editable failed to load'))
        }
      }

      script.onerror = () => {
        reject(new Error('Failed to load Leaflet.Editable script'))
      }

      document.head.appendChild(script)
    })
  }

  const initializeMap = async () => {
    if (!mapContainer.value) return

    try {
      const L = await loadLeaflet()

      // Charger Leaflet.Editable si mode édition
      if (editable) {
        await loadLeafletEditable()
      }

      // Initialiser la carte avec l'option editable
      leafletMapInstance = L.map(mapContainer.value, {
        editable: editable,
      }).setView(center, zoom)

      // Couches de tuiles
      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        zIndex: 1,
        maxZoom: 22,
        maxNativeZoom: 19,
      })

      const satelliteLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: '© Esri, Maxar, Earthstar Geographics',
          zIndex: 1,
          maxZoom: 22,
          maxNativeZoom: 19,
        }
      )

      // Ajouter la couche par défaut et le contrôle de couches
      osmLayer.addTo(leafletMapInstance)
      tileLayerRef.value = osmLayer

      L.control
        .layers({ Plan: osmLayer, Satellite: satelliteLayer }, {}, { position: 'topright' })
        .addTo(leafletMapInstance)

      // S'assurer que le tile pane a le bon z-index
      const tilePane = mapContainer.value.querySelector('.leaflet-tile-pane') as HTMLElement
      if (tilePane) {
        tilePane.style.zIndex = '1'
      }

      // Délégation d'événements pour les boutons d'action dans les popups
      // (plus fiable que popupopen + querySelector, car insensible aux animations fitBounds/setView)
      if (onEditRequest || onDeleteRequest) {
        popupActionHandler = (e: MouseEvent) => {
          const target = (e.target as HTMLElement).closest(
            '.leaflet-popup-edit-btn, .leaflet-popup-delete-btn'
          ) as HTMLElement | null
          if (!target) return
          e.preventDefault()
          const key = target.dataset.key
          if (!key) return
          const [type, idStr] = key.split(':')
          const id = parseInt(idStr)
          if ((type !== 'zone' && type !== 'marker') || isNaN(id)) return
          if (target.classList.contains('leaflet-popup-edit-btn') && onEditRequest) {
            onEditRequest(type as 'zone' | 'marker', id)
          } else if (target.classList.contains('leaflet-popup-delete-btn') && onDeleteRequest) {
            onDeleteRequest(type as 'zone' | 'marker', id)
          }
        }
        leafletMapInstance.getContainer().addEventListener('click', popupActionHandler)
      }

      // Attendre que la carte soit prête (pour que editTools soit disponible)
      // avant d'exposer la ref map
      if (editable) {
        leafletMapInstance.whenReady(() => {
          map.value = leafletMapInstance
          isLoading.value = false
        })
      } else {
        map.value = leafletMapInstance
        isLoading.value = false
      }
    } catch (err) {
      console.error('Error initializing map:', err)
      error.value = "Erreur lors de l'initialisation de la carte"
      isLoading.value = false
    }
  }

  const buildTypesHtml = (types: string[]) => {
    if (types.length === 0) return ''
    const items = types
      .map((type) => {
        const svg = getZoneTypeSvgIcon(type as EditionZoneType)
        const color = getZoneTypeColor(type as EditionZoneType)
        const label = typeLabel ? escapeHtml(typeLabel(type)) : type
        return `<span style="display:inline-flex;align-items:center;gap:3px;color:${color}">${svg} <span style="font-size:12px">${label}</span></span>`
      })
      .join('')
    return `<div style="margin-top:2px;display:flex;flex-wrap:wrap;align-items:center;gap:4px">${items}</div>`
  }

  const editSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>`
  const deleteSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>`
  const navSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>`

  const buildPopupContent = (
    name: string,
    description?: string | null,
    types?: string[],
    extraHtml?: string,
    coords?: [number, number],
    itemKey?: string
  ) => {
    let html = `<strong>${escapeHtml(name)}</strong>`
    if (types && types.length > 0) html += buildTypesHtml(types)
    if (description) html += `<br/>${escapeHtmlWithNewlines(description)}`
    if (extraHtml) html += extraHtml
    // Lien navigation
    if (coords) {
      const navLabel = escapeHtml(popupLabels.navigate || 'Itinéraire')
      const navUrl = `https://www.google.com/maps/search/?api=1&query=${coords[0]},${coords[1]}`
      html += `<div style="margin-top:6px"><a href="${navUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#3b82f6;text-decoration:none">${navSvg}${navLabel}</a></div>`
    }
    // Boutons d'action (modifier / supprimer)
    if (itemKey && (onEditRequest || onDeleteRequest)) {
      const actions: string[] = []
      if (onEditRequest) {
        const editLabel = escapeHtml(popupLabels.edit || 'Modifier')
        actions.push(
          `<a href="#" class="leaflet-popup-edit-btn" data-key="${itemKey}" style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#3b82f6;text-decoration:none">${editSvg}${editLabel}</a>`
        )
      }
      if (onDeleteRequest) {
        const deleteLabel = escapeHtml(popupLabels.delete || 'Supprimer')
        actions.push(
          `<a href="#" class="leaflet-popup-delete-btn" data-key="${itemKey}" style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#ef4444;text-decoration:none">${deleteSvg}${deleteLabel}</a>`
        )
      }
      html += `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #e5e7eb;display:flex;gap:12px;align-items:center">${actions.join('')}</div>`
    }
    return html
  }

  const addPolygon = (zone: EditionZoneData) => {
    if (!map.value || !window.L || !zone.id) return

    // Vérifier si le polygone existe déjà pour éviter les doublons
    if (polygons.value.has(zone.id)) {
      return
    }

    // Les coordonnées sont déjà stockées en [lat, lng] (format Leaflet natif)
    const latLngs = zone.coordinates

    const polygon = window.L.polygon(latLngs, {
      color: zone.color,
      fillColor: zone.color,
      fillOpacity: 0.3,
      weight: 2,
    })

    // Calculer le centroïde de la zone pour le lien de navigation
    const centroidLat = zone.coordinates.reduce((sum, c) => sum + c[0], 0) / zone.coordinates.length
    const centroidLng = zone.coordinates.reduce((sum, c) => sum + c[1], 0) / zone.coordinates.length
    const zoneCoords: [number, number] = [centroidLat, centroidLng]

    // Ajouter un popup avec le nom (échappement HTML pour prévenir XSS)
    const key = `zone:${zone.id}`
    popupBaseData.set(key, {
      name: zone.name,
      description: zone.description,
      types: zone.zoneTypes,
      coords: zoneCoords,
    })
    polygon.bindPopup(
      buildPopupContent(
        zone.name,
        zone.description,
        zone.zoneTypes,
        popupExtraContent.get(key),
        zoneCoords,
        key
      )
    )

    // D'abord ajouter le polygone à la carte
    polygon.addTo(map.value)
    polygons.value.set(zone.id, polygon)

    // Ajouter une icône de type au centre de la zone
    const zoneIcon = getZoneIcon(zone.zoneTypes, zone.color)
    if (zoneIcon) {
      const center = polygon.getBounds().getCenter()
      const iconMarker = window.L.marker(center, {
        icon: zoneIcon,
        interactive: false,
      })
      iconMarker.addTo(map.value)
      zoneIconMarkers.value.set(zone.id, iconMarker)
    }

    // Si mode édition, activer l'édition du polygone (après l'avoir ajouté à la carte)
    const editTools: EditTools | undefined = map.value?.editTools
    if (editable && editTools) {
      try {
        polygon.enableEdit()

        // Écouter les modifications
        polygon.on('editable:vertex:dragend', () => {
          if (zone.id && onPolygonEdited) {
            const coords = polygon.getLatLngs()[0] as any[]
            const newCoords = coords.map(
              (latLng: any) => [latLng.lat, latLng.lng] as [number, number]
            )
            onPolygonEdited(zone.id, newCoords)

            // Repositionner l'icône de zone au nouveau centroïde
            const iconMarker = zoneIconMarkers.value.get(zone.id)
            if (iconMarker) {
              iconMarker.setLatLng(polygon.getBounds().getCenter())
            }
          }
        })
      } catch (err) {
        console.warn('Could not enable edit on polygon:', err)
      }
    }
  }

  const addZones = (zones: EditionZoneData[]) => {
    zones.forEach(addPolygon)
  }

  const updatePolygonStyle = (zoneId: number, color: string) => {
    const polygon = polygons.value.get(zoneId)
    if (polygon) {
      polygon.setStyle({
        color,
        fillColor: color,
      })
    }
  }

  const updatePolygonPopup = (
    zoneId: number,
    name: string,
    description?: string | null,
    types?: string[]
  ) => {
    const key = `zone:${zoneId}`
    const existing = popupBaseData.get(key)
    const existingTypes = types ?? existing?.types
    const existingCoords = existing?.coords
    popupBaseData.set(key, { name, description, types: existingTypes, coords: existingCoords })
    const polygon = polygons.value.get(zoneId)
    if (polygon) {
      polygon.setPopupContent(
        buildPopupContent(
          name,
          description,
          existingTypes,
          popupExtraContent.get(key),
          existingCoords,
          key
        )
      )
    }
  }

  const updateZoneIcon = (zoneId: number, zoneTypes: string[], color: string) => {
    const iconMarker = zoneIconMarkers.value.get(zoneId)
    const polygon = polygons.value.get(zoneId)
    if (iconMarker && polygon && map.value) {
      map.value.removeLayer(iconMarker)
      zoneIconMarkers.value.delete(zoneId)

      const newIcon = getZoneIcon(zoneTypes, color)
      if (newIcon) {
        const center = polygon.getBounds().getCenter()
        const newIconMarker = window.L.marker(center, {
          icon: newIcon,
          interactive: false,
        })
        newIconMarker.addTo(map.value)
        zoneIconMarkers.value.set(zoneId, newIconMarker)
      }
    }
  }

  const removePolygon = (zoneId: number) => {
    const polygon = polygons.value.get(zoneId)
    if (polygon && map.value) {
      map.value.removeLayer(polygon)
      polygons.value.delete(zoneId)
    }
    const iconMarker = zoneIconMarkers.value.get(zoneId)
    if (iconMarker && map.value) {
      map.value.removeLayer(iconMarker)
      zoneIconMarkers.value.delete(zoneId)
    }
    // Nettoyer les données de popup orphelines
    const key = `zone:${zoneId}`
    popupBaseData.delete(key)
    popupExtraContent.delete(key)
  }

  const clearPolygons = () => {
    polygons.value.forEach((polygon) => {
      if (map.value) {
        map.value.removeLayer(polygon)
      }
    })
    polygons.value.clear()
    zoneIconMarkers.value.forEach((marker) => {
      if (map.value) {
        map.value.removeLayer(marker)
      }
    })
    zoneIconMarkers.value.clear()
    // Nettoyer les données de popup des zones
    for (const key of [...popupBaseData.keys()]) {
      if (key.startsWith('zone:')) popupBaseData.delete(key)
    }
    for (const key of [...popupExtraContent.keys()]) {
      if (key.startsWith('zone:')) popupExtraContent.delete(key)
    }
  }

  const startDrawing = (color: string = '#3b82f6') => {
    if (!map.value || !editable) {
      console.warn('startDrawing: map or editable not ready')
      return
    }

    // Vérifier que editTools est disponible
    const editTools: EditTools | undefined = map.value?.editTools
    if (!editTools) {
      console.warn('startDrawing: editTools not available')
      return
    }

    try {
      // Démarrer le dessin d'un nouveau polygone AVANT de changer isDrawing
      // pour éviter que le re-render Vue interfère avec Leaflet
      currentDrawingPolygon.value = editTools.startPolygon(undefined, {
        color,
        fillColor: color,
        fillOpacity: 0.3,
        weight: 2,
      })

      // Écouter la fin du dessin
      if (currentDrawingPolygon.value) {
        currentDrawingPolygon.value.on('editable:drawing:end', () => {
          if (currentDrawingPolygon.value && onPolygonCreated) {
            const coords = currentDrawingPolygon.value.getLatLngs()[0] as any[]
            if (coords && coords.length >= 3) {
              const newCoords = coords.map(
                (latLng: any) => [latLng.lat, latLng.lng] as [number, number]
              )
              onPolygonCreated(newCoords)
            }
          }
          isDrawing.value = false
        })
      }

      // Mettre à jour isDrawing APRÈS avoir démarré le dessin
      isDrawing.value = true
    } catch (err) {
      console.error('startDrawing error:', err)
      isDrawing.value = false
    }
  }

  const stopDrawing = () => {
    try {
      if (currentDrawingPolygon.value && map.value) {
        // Supprimer le polygone en cours de dessin
        map.value.removeLayer(currentDrawingPolygon.value)
        currentDrawingPolygon.value = null
      }

      // Annuler tout dessin en cours via editTools
      const editTools: EditTools | undefined = map.value?.editTools
      if (editTools) {
        editTools.stopDrawing()
      }
    } catch (err) {
      console.error('stopDrawing error:', err)
    }
    isDrawing.value = false
  }

  const commitDrawing = () => {
    const editTools: EditTools | undefined = map.value?.editTools
    if (currentDrawingPolygon.value && map.value && editTools) {
      editTools.commitDrawing()
    }
  }

  const fitBoundsToZones = () => {
    if (!map.value || polygons.value.size === 0) return

    const bounds = window.L.latLngBounds([])
    polygons.value.forEach((polygon) => {
      bounds.extend(polygon.getBounds())
    })

    if (bounds.isValid()) {
      map.value.fitBounds(bounds, { padding: [50, 50] })
    }
  }

  const setView = (newCenter: LatLngExpression, newZoom?: number) => {
    if (!map.value) return
    map.value.setView(newCenter, newZoom)
  }

  const focusOnZone = (zoneId: number) => {
    const polygon = polygons.value.get(zoneId)
    if (polygon && map.value) {
      map.value.fitBounds(polygon.getBounds(), { padding: [50, 50] })
      polygon.openPopup()
    }
  }

  // ============================================================================
  // FONCTIONS POUR LES MARQUEURS
  // ============================================================================

  const getZoneIcon = (zoneTypes: string[], color: string) => {
    const L = window.L
    if (!L || zoneTypes.length === 0) return null

    const iconsHtml = zoneTypes.map((type) => getZoneTypeSvgIcon(type)).join('')
    const iconCount = zoneTypes.length
    const width = iconCount === 1 ? 28 : 20 * iconCount + 8

    const safeColor = sanitizeColor(color)
    return L.divIcon({
      className: 'zone-icon',
      html: `<div class="zone-icon-inner" style="border-color: ${safeColor}; color: ${safeColor};">${iconsHtml}</div>`,
      iconSize: [width, 28],
      iconAnchor: [width / 2, 14],
    })
  }

  const getMarkerIcon = (markerTypes: string[], customColor?: string | null) => {
    const L = window.L
    if (!L || markerTypes.length === 0) return null

    // Utiliser la couleur personnalisée si définie, sinon la couleur du premier type
    const color = sanitizeColor(customColor || getZoneTypeColor(markerTypes[0]))
    const iconsHtml = markerTypes.map((type) => getZoneTypeSvgIcon(type)).join('')
    const iconCount = markerTypes.length
    const width = iconCount === 1 ? 32 : 22 * iconCount + 10

    return L.divIcon({
      className: 'custom-marker-icon',
      html: `<div class="marker-icon" style="border-color: ${color}; color: ${color};">${iconsHtml}</div>`,
      iconSize: [width, 32],
      iconAnchor: [width / 2, 32],
      popupAnchor: [0, -32],
    })
  }

  const addMarker = (marker: EditionMarkerData) => {
    if (!map.value || !window.L || !marker.id) return

    // Vérifier si le marqueur existe déjà
    if (leafletMarkers.value.has(marker.id)) {
      return
    }

    const icon = getMarkerIcon(marker.markerTypes, marker.color)

    const leafletMarker = window.L.marker([marker.latitude, marker.longitude], {
      icon,
      draggable: editable,
    })

    // Ajouter un popup avec le nom (échappement HTML pour prévenir XSS)
    const markerCoords: [number, number] = [marker.latitude, marker.longitude]
    const key = `marker:${marker.id}`
    popupBaseData.set(key, {
      name: marker.name,
      description: marker.description,
      types: marker.markerTypes,
      coords: markerCoords,
    })
    leafletMarker.bindPopup(
      buildPopupContent(
        marker.name,
        marker.description,
        marker.markerTypes,
        popupExtraContent.get(key),
        markerCoords,
        key
      )
    )

    leafletMarker.addTo(map.value)
    leafletMarkers.value.set(marker.id, leafletMarker)

    // Écouter le drag si mode édition
    // Capturer l'ID dans une variable locale pour éviter le non-null assertion dans la closure
    const markerId = marker.id
    if (editable && onMarkerMoved) {
      leafletMarker.on('dragend', () => {
        const position = leafletMarker.getLatLng()
        onMarkerMoved(markerId, position.lat, position.lng)
      })
    }
  }

  const addMarkers = (markers: EditionMarkerData[]) => {
    markers.forEach(addMarker)
  }

  const updateMarkerPosition = (markerId: number, latitude: number, longitude: number) => {
    const marker = leafletMarkers.value.get(markerId)
    if (marker) {
      marker.setLatLng([latitude, longitude])
    }
  }

  const updateMarkerPopup = (
    markerId: number,
    name: string,
    description?: string | null,
    types?: string[]
  ) => {
    const key = `marker:${markerId}`
    const existing = popupBaseData.get(key)
    const existingTypes = types ?? existing?.types
    const existingCoords = existing?.coords
    popupBaseData.set(key, { name, description, types: existingTypes, coords: existingCoords })
    const marker = leafletMarkers.value.get(markerId)
    if (marker) {
      marker.setPopupContent(
        buildPopupContent(
          name,
          description,
          existingTypes,
          popupExtraContent.get(key),
          existingCoords,
          key
        )
      )
    }
  }

  const setPopupExtra = (type: 'zone' | 'marker', id: number, extraHtml: string) => {
    const key = `${type}:${id}`
    popupExtraContent.set(key, extraHtml)

    const base = popupBaseData.get(key)
    if (!base) return

    const newContent = buildPopupContent(
      base.name,
      base.description,
      base.types,
      extraHtml,
      base.coords,
      key
    )
    if (type === 'zone') {
      const polygon = polygons.value.get(id)
      if (polygon) polygon.setPopupContent(newContent)
    } else {
      const marker = leafletMarkers.value.get(id)
      if (marker) marker.setPopupContent(newContent)
    }
  }

  const updateMarkerIcon = (
    markerId: number,
    markerTypes: string[],
    customColor?: string | null
  ) => {
    const marker = leafletMarkers.value.get(markerId)
    if (marker) {
      const icon = getMarkerIcon(markerTypes, customColor)
      if (icon) {
        marker.setIcon(icon)
      }
    }
  }

  const removeMarker = (markerId: number) => {
    const marker = leafletMarkers.value.get(markerId)
    if (marker && map.value) {
      map.value.removeLayer(marker)
      leafletMarkers.value.delete(markerId)
    }
    // Nettoyer les données de popup orphelines
    const key = `marker:${markerId}`
    popupBaseData.delete(key)
    popupExtraContent.delete(key)
  }

  const clearMarkers = () => {
    leafletMarkers.value.forEach((marker) => {
      if (map.value) {
        map.value.removeLayer(marker)
      }
    })
    leafletMarkers.value.clear()
    // Nettoyer les données de popup des marqueurs
    for (const key of [...popupBaseData.keys()]) {
      if (key.startsWith('marker:')) popupBaseData.delete(key)
    }
    for (const key of [...popupExtraContent.keys()]) {
      if (key.startsWith('marker:')) popupExtraContent.delete(key)
    }
  }

  const startPlacingMarker = () => {
    if (!map.value || !editable) {
      console.warn('startPlacingMarker: map or editable not ready')
      return
    }

    isPlacingMarker.value = true

    // Changer le curseur
    const container = map.value.getContainer()
    container.style.cursor = 'crosshair'

    // Écouter le clic pour placer le marqueur
    markerPlacementHandler = (e: LeafletMouseEvent) => {
      if (onMarkerCreated) {
        onMarkerCreated(e.latlng.lat, e.latlng.lng)
      }
      stopPlacingMarker()
    }

    map.value.once('click', markerPlacementHandler)
  }

  const stopPlacingMarker = () => {
    if (!map.value) return

    isPlacingMarker.value = false

    // Restaurer le curseur
    const container = map.value.getContainer()
    container.style.cursor = ''

    // Supprimer le listener de clic
    if (markerPlacementHandler) {
      map.value.off('click', markerPlacementHandler)
      markerPlacementHandler = null
    }
  }

  const focusOnMarker = (markerId: number) => {
    const marker = leafletMarkers.value.get(markerId)
    if (marker && map.value) {
      const position = marker.getLatLng()
      map.value.setView(position, 17)
      marker.openPopup()
    }
  }

  // ============================================================================
  // FONCTIONS DE VISIBILITÉ
  // ============================================================================

  const showZone = (zoneId: number) => {
    const polygon = polygons.value.get(zoneId)
    if (polygon && map.value) {
      polygon.addTo(map.value)
    }
    const iconMarker = zoneIconMarkers.value.get(zoneId)
    if (iconMarker && map.value) {
      iconMarker.addTo(map.value)
    }
  }

  const hideZone = (zoneId: number) => {
    const polygon = polygons.value.get(zoneId)
    if (polygon && map.value) {
      map.value.removeLayer(polygon)
    }
    const iconMarker = zoneIconMarkers.value.get(zoneId)
    if (iconMarker && map.value) {
      map.value.removeLayer(iconMarker)
    }
  }

  const showMarker = (markerId: number) => {
    const marker = leafletMarkers.value.get(markerId)
    if (marker && map.value) {
      marker.addTo(map.value)
    }
  }

  const hideMarker = (markerId: number) => {
    const marker = leafletMarkers.value.get(markerId)
    if (marker && map.value) {
      map.value.removeLayer(marker)
    }
  }

  const fitBoundsToItems = () => {
    if (!map.value || (polygons.value.size === 0 && leafletMarkers.value.size === 0)) return

    const bounds = window.L.latLngBounds([])

    polygons.value.forEach((polygon) => {
      bounds.extend(polygon.getBounds())
    })

    leafletMarkers.value.forEach((marker) => {
      bounds.extend(marker.getLatLng())
    })

    if (bounds.isValid()) {
      map.value.fitBounds(bounds, { padding: [50, 50] })
    }
  }

  const destroy = () => {
    // Retirer le handler de délégation d'événements avant de supprimer la carte
    if (popupActionHandler && leafletMapInstance) {
      leafletMapInstance.getContainer().removeEventListener('click', popupActionHandler)
      popupActionHandler = null
    }
    // Utiliser leafletMapInstance pour le nettoyage (peut exister même si map.value est null)
    if (leafletMapInstance) {
      leafletMapInstance.remove()
      leafletMapInstance = null
    }
    map.value = null
    polygons.value.clear()
    zoneIconMarkers.value.clear()
    leafletMarkers.value.clear()
    popupBaseData.clear()
    popupExtraContent.clear()
    currentDrawingPolygon.value = null
    isDrawing.value = false
    isPlacingMarker.value = false
    markerPlacementHandler = null
  }

  // Initialiser la carte quand le conteneur devient disponible
  // (nécessaire car le conteneur peut être dans un v-if/v-else)
  watch(
    mapContainer,
    (newContainer) => {
      if (newContainer && !leafletMapInstance) {
        initializeMap()
      }
    },
    { immediate: true }
  )

  onUnmounted(() => {
    destroy()
  })

  return {
    map: readonly(map),
    isLoading: readonly(isLoading),
    error: readonly(error),
    isDrawing: readonly(isDrawing),
    isPlacingMarker: readonly(isPlacingMarker),
    // Fonctions pour les zones (polygones)
    addPolygon,
    addZones,
    updatePolygonStyle,
    updatePolygonPopup,
    updateZoneIcon,
    removePolygon,
    clearPolygons,
    startDrawing,
    stopDrawing,
    commitDrawing,
    fitBoundsToZones,
    setView,
    focusOnZone,
    // Fonctions pour les marqueurs
    addMarker,
    addMarkers,
    updateMarkerPosition,
    updateMarkerPopup,
    updateMarkerIcon,
    removeMarker,
    clearMarkers,
    startPlacingMarker,
    stopPlacingMarker,
    focusOnMarker,
    fitBoundsToItems,
    // Contenu supplémentaire dans les popups
    setPopupExtra,
    // Fonctions de visibilité
    showZone,
    hideZone,
    showMarker,
    hideMarker,
    // Nettoyage
    destroy,
  }
}
