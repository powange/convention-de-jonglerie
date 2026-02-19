import type { EditableMap, EditablePolygon, EditTools } from '~/types/leaflet-global'
import { escapeHtml, escapeHtmlWithNewlines } from '~/utils/mapMarkers'

import type { Marker, LatLngExpression, TileLayer, LeafletMouseEvent } from 'leaflet'
import type { Ref } from 'vue'

// getZoneTypeColor et getZoneTypeSvgIcon sont auto-importés depuis shared/utils/zone-types.ts

export interface EditionZoneData {
  id?: number
  name: string
  description?: string | null
  color: string
  coordinates: [number, number][]
  zoneType: string
  order?: number
}

export interface EditionMarkerData {
  id?: number
  name: string
  description?: string | null
  latitude: number
  longitude: number
  markerType: string
  color?: string | null
  order?: number
}

export interface UseLeafletEditableOptions {
  center?: LatLngExpression
  zoom?: number
  editable?: boolean
  onPolygonCreated?: (coordinates: [number, number][]) => void
  onPolygonEdited?: (zoneId: number, coordinates: [number, number][]) => void
  onMarkerCreated?: (latitude: number, longitude: number) => void
  onMarkerMoved?: (markerId: number, latitude: number, longitude: number) => void
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
  const currentDrawingPolygon = shallowRef<EditablePolygon | null>(null)
  // Référence locale pour le nettoyage (au cas où whenReady n'a pas encore été appelé)
  let leafletMapInstance: EditableMap | null = null
  // Référence pour le handler de clic lors du placement de marqueur
  let markerPlacementHandler: ((e: LeafletMouseEvent) => void) | null = null

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

      // Ajouter le layer de tuiles avec un z-index élevé pour éviter qu'il soit caché
      tileLayerRef.value = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        zIndex: 1,
      }).addTo(leafletMapInstance)

      // S'assurer que le tile pane a le bon z-index
      const tilePane = mapContainer.value.querySelector('.leaflet-tile-pane') as HTMLElement
      if (tilePane) {
        tilePane.style.zIndex = '1'
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

    // Ajouter un popup avec le nom (échappement HTML pour prévenir XSS)
    const popupContent = `<strong>${escapeHtml(zone.name)}</strong>${zone.description ? `<br/>${escapeHtmlWithNewlines(zone.description)}` : ''}`
    polygon.bindPopup(popupContent)

    // D'abord ajouter le polygone à la carte
    polygon.addTo(map.value)
    polygons.value.set(zone.id, polygon)

    // Ajouter une icône de type au centre de la zone
    const zoneIcon = getZoneIcon(zone.zoneType, zone.color)
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

  const updatePolygonPopup = (zoneId: number, name: string, description?: string | null) => {
    const polygon = polygons.value.get(zoneId)
    if (polygon) {
      const popupContent = `<strong>${escapeHtml(name)}</strong>${description ? `<br/>${escapeHtmlWithNewlines(description)}` : ''}`
      polygon.setPopupContent(popupContent)
    }
  }

  const updateZoneIcon = (zoneId: number, zoneType: string, color: string) => {
    const iconMarker = zoneIconMarkers.value.get(zoneId)
    const polygon = polygons.value.get(zoneId)
    if (iconMarker && polygon && map.value) {
      map.value.removeLayer(iconMarker)
      zoneIconMarkers.value.delete(zoneId)

      const newIcon = getZoneIcon(zoneType, color)
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

  const getZoneIcon = (zoneType: string, color: string) => {
    const L = window.L
    if (!L) return null

    const svgIcon = getZoneTypeSvgIcon(zoneType)

    return L.divIcon({
      className: 'zone-icon',
      html: `<div class="zone-icon-inner" style="border-color: ${color}; color: ${color};">${svgIcon}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    })
  }

  const getMarkerIcon = (markerType: string, customColor?: string | null) => {
    const L = window.L
    if (!L) return null

    // Utiliser la couleur personnalisée si définie, sinon la couleur du type
    const color = customColor || getZoneTypeColor(markerType)
    const svgIcon = getZoneTypeSvgIcon(markerType)

    return L.divIcon({
      className: 'custom-marker-icon',
      html: `<div class="marker-icon" style="border-color: ${color}; color: ${color};">${svgIcon}</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    })
  }

  const addMarker = (marker: EditionMarkerData) => {
    if (!map.value || !window.L || !marker.id) return

    // Vérifier si le marqueur existe déjà
    if (leafletMarkers.value.has(marker.id)) {
      return
    }

    const icon = getMarkerIcon(marker.markerType, marker.color)

    const leafletMarker = window.L.marker([marker.latitude, marker.longitude], {
      icon,
      draggable: editable,
    })

    // Ajouter un popup avec le nom (échappement HTML pour prévenir XSS)
    const popupContent = `<strong>${escapeHtml(marker.name)}</strong>${marker.description ? `<br/>${escapeHtmlWithNewlines(marker.description)}` : ''}`
    leafletMarker.bindPopup(popupContent)

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

  const updateMarkerPopup = (markerId: number, name: string, description?: string | null) => {
    const marker = leafletMarkers.value.get(markerId)
    if (marker) {
      const popupContent = `<strong>${escapeHtml(name)}</strong>${description ? `<br/>${escapeHtmlWithNewlines(description)}` : ''}`
      marker.setPopupContent(popupContent)
    }
  }

  const updateMarkerIcon = (markerId: number, markerType: string, customColor?: string | null) => {
    const marker = leafletMarkers.value.get(markerId)
    if (marker) {
      const icon = getMarkerIcon(markerType, customColor)
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
  }

  const clearMarkers = () => {
    leafletMarkers.value.forEach((marker) => {
      if (map.value) {
        map.value.removeLayer(marker)
      }
    })
    leafletMarkers.value.clear()
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
    // Utiliser leafletMapInstance pour le nettoyage (peut exister même si map.value est null)
    if (leafletMapInstance) {
      leafletMapInstance.remove()
      leafletMapInstance = null
    }
    map.value = null
    polygons.value.clear()
    zoneIconMarkers.value.clear()
    leafletMarkers.value.clear()
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
    // Fonctions de visibilité
    showZone,
    hideZone,
    showMarker,
    hideMarker,
    // Nettoyage
    destroy,
  }
}
