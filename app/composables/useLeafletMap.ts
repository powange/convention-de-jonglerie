import type { Ref } from 'vue'
import type { Map as LeafletMap, Marker, LatLngExpression } from 'leaflet'

export interface MapMarker {
  id: string | number
  position: [number, number]
  popupContent: string
  icon?: any
}

export interface UseLeafletMapOptions {
  center?: LatLngExpression
  zoom?: number
  markers?: MapMarker[]
  onMarkerClick?: (marker: MapMarker) => void
}

export const useLeafletMap = (
  mapContainer: Ref<HTMLElement | null>,
  options: UseLeafletMapOptions = {}
) => {
  const {
    center = [46.603354, 1.888334],
    zoom = 6,
    markers = [],
    onMarkerClick
  } = options

  const map = ref<LeafletMap | null>(null)
  const leafletMarkers = ref<Map<string | number, Marker>>(new Map())
  const isLoading = ref(true)
  const error = ref<string | null>(null)

  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const options: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }

    if (start.getTime() === end.getTime()) {
      return start.toLocaleDateString('fr-FR', options)
    }

    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${start.getDate()} - ${end.toLocaleDateString('fr-FR', options)}`
    }

    if (start.getFullYear() === end.getFullYear()) {
      const startOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
      return `${start.toLocaleDateString('fr-FR', startOptions)} - ${end.toLocaleDateString('fr-FR', options)}`
    }

    return `${start.toLocaleDateString('fr-FR', options)} - ${end.toLocaleDateString('fr-FR', options)}`
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
    } finally {
      isLoading.value = false
    }
  }

  const initializeMap = async () => {
    if (!mapContainer.value) return

    try {
      const L = await loadLeaflet()

      // Initialiser la carte
      map.value = L.map(mapContainer.value).setView(center, zoom)

      // Ajouter le layer de tuiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map.value)

      // Ajouter les marqueurs initiaux
      if (markers.length > 0) {
        addMarkers(markers)
      }
    } catch (err) {
      console.error('Error initializing map:', err)
      error.value = 'Erreur lors de l\'initialisation de la carte'
    }
  }

  const addMarkers = (newMarkers: MapMarker[]) => {
    if (!map.value || !window.L) return

    newMarkers.forEach(markerData => {
      const marker = window.L.marker(markerData.position, {
        icon: markerData.icon || window.L.icon({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        })
      })

      marker.bindPopup(markerData.popupContent)
      
      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(markerData))
      }

      marker.addTo(map.value!)
      leafletMarkers.value.set(markerData.id, marker)
    })
  }

  const clearMarkers = () => {
    leafletMarkers.value.forEach(marker => {
      if (map.value) {
        map.value.removeLayer(marker)
      }
    })
    leafletMarkers.value.clear()
  }

  const updateMarkers = (newMarkers: MapMarker[]) => {
    clearMarkers()
    addMarkers(newMarkers)
  }

  const fitBounds = (bounds: [[number, number], [number, number]], options?: any) => {
    if (!map.value || !window.L) return
    map.value.fitBounds(bounds, options)
  }

  const setView = (center: LatLngExpression, zoom?: number) => {
    if (!map.value) return
    map.value.setView(center, zoom)
  }

  const destroy = () => {
    if (map.value) {
      map.value.remove()
      map.value = null
    }
    leafletMarkers.value.clear()
  }

  onMounted(() => {
    initializeMap()
  })

  onUnmounted(() => {
    destroy()
  })

  return {
    map: readonly(map),
    isLoading: readonly(isLoading),
    error: readonly(error),
    addMarkers,
    clearMarkers,
    updateMarkers,
    fitBounds,
    setView,
    formatDateRange,
    destroy
  }
}