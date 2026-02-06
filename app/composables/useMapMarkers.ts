import type { MapMarker } from '~/composables/useLeafletMap'
import type { Edition } from '~/types'
import { getEditionDisplayName } from '~/utils/editionName'
import { createCustomMarkerIcon, escapeHtml, getEditionStatus } from '~/utils/mapMarkers'

/**
 * Contexte pré-calculé et échappé fourni au callback de construction de popup.
 */
export interface PopupBuilderContext {
  name: string
  city: string
  country: string
  imageUrl: string
  dateRange: string
  description: string | null
  detailUrl: string
  t: ReturnType<typeof useI18n>['t']
}

export type PopupBuilderCallback = (ctx: PopupBuilderContext, isFavorite: boolean) => string

export interface UseMapMarkersOptions {
  mapContainer: Ref<HTMLElement | null>
  editions: ComputedRef<Edition[]> | Ref<Edition[]>
  popupBuilder: PopupBuilderCallback
  isFavorite?: (edition: Edition) => boolean
  mapOptions?: {
    center?: [number, number]
    zoom?: number
  }
}

export const useMapMarkers = (options: UseMapMarkersOptions) => {
  const { mapContainer, editions, popupBuilder, isFavorite = () => false, mapOptions } = options

  const { t, locale } = useI18n()
  const { getImageUrl } = useImageUrl()
  const { translateCountryName } = useCountryTranslation()

  const formatDateRangeLocal = (startDate: string, endDate: string): string => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const loc = locale.value
    const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
    if (start.getTime() === end.getTime()) return start.toLocaleDateString(loc, opts)
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${start.getDate()} - ${end.toLocaleDateString(loc, opts)}`
    }
    if (start.getFullYear() === end.getFullYear()) {
      const startOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
      return `${start.toLocaleDateString(loc, startOpts)} - ${end.toLocaleDateString(loc, opts)}`
    }
    return `${start.toLocaleDateString(loc, opts)} - ${end.toLocaleDateString(loc, opts)}`
  }

  const getEditionImageUrl = (edition: Edition): string => {
    return getImageUrl(edition.imageUrl, 'edition', edition.id) || ''
  }

  const createMarkers = (): MapMarker[] => {
    if (!import.meta.client || !(window as any).L) return []

    return editions.value.map((edition) => {
      const isFav = isFavorite(edition)
      const status = getEditionStatus(edition.startDate, edition.endDate)
      const Lany = (window as any).L as any

      const icon = createCustomMarkerIcon(Lany, {
        isUpcoming: status.isUpcoming,
        isOngoing: status.isOngoing,
        isFavorite: isFav,
      })

      const ctx: PopupBuilderContext = {
        name: escapeHtml(getEditionDisplayName(edition)),
        city: escapeHtml(edition.city || ''),
        country: escapeHtml(translateCountryName(edition.country)),
        imageUrl: getEditionImageUrl(edition),
        dateRange: formatDateRangeLocal(edition.startDate, edition.endDate),
        description: edition.description ? escapeHtml(edition.description) : null,
        detailUrl: `/editions/${edition.id}`,
        t,
      }

      return {
        id: edition.id,
        position: [edition.latitude!, edition.longitude!] as [number, number],
        popupContent: popupBuilder(ctx, isFav),
        icon,
      }
    })
  }

  // Initialisation SSR-safe de useLeafletMap
  const mapUtils = import.meta.client
    ? useLeafletMap(mapContainer, {
        center: mapOptions?.center ?? [46.603354, 1.888334],
        zoom: mapOptions?.zoom ?? 6,
        markers: [],
      })
    : {
        isLoading: ref(false),
        formatDateRange: (_start: string, _end: string) => '',
        addMarkers: (_m: MapMarker[]) => {},
        clearMarkers: () => {},
        updateMarkers: (_m: MapMarker[]) => {},
        fitBounds: (_b: any, _o?: any) => {},
        setView: (_c: any, _z?: number) => {},
      }

  const tryAddMarkers = (): boolean => {
    if ((window as any).L && editions.value.length > 0) {
      const markers = createMarkers()
      if (markers.length > 0 && mapUtils.updateMarkers) {
        mapUtils.updateMarkers(markers)

        if (mapUtils.fitBounds) {
          const Lany = (window as any).L as any
          const bounds = markers.map((m) => m.position)
          const leafletBounds = Lany.latLngBounds(bounds)
          mapUtils.fitBounds(leafletBounds.pad(0.1))
        }
        return true
      }
    }
    return false
  }

  // Polling Leaflet + lifecycle + watcher
  if (import.meta.client) {
    let checkLeafletInterval: ReturnType<typeof setInterval> | null = null
    let checkLeafletTimeout: ReturnType<typeof setTimeout> | null = null

    onMounted(() => {
      checkLeafletInterval = setInterval(() => {
        if ((window as any).L) {
          if (tryAddMarkers()) {
            clearInterval(checkLeafletInterval!)
            checkLeafletInterval = null
          }
        }
      }, 100)

      checkLeafletTimeout = setTimeout(() => {
        if (checkLeafletInterval) {
          clearInterval(checkLeafletInterval)
          checkLeafletInterval = null
        }
      }, 10000)
    })

    onBeforeUnmount(() => {
      if (checkLeafletInterval) clearInterval(checkLeafletInterval)
      if (checkLeafletTimeout) clearTimeout(checkLeafletTimeout)
    })

    watch(editions, () => {
      if ((window as any).L) {
        tryAddMarkers()
      }
    })
  }

  return {
    isLoading: mapUtils.isLoading,
    mapUtils,
  }
}
