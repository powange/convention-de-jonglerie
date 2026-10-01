import type { MapMarker } from '~/composables/useLeafletMap'
import type { Edition } from '~/types'
import { getEditionDisplayName } from '~/utils/editionName'
import { createCustomMarkerIcon, escapeHtml, getEditionStatus } from '~/utils/mapMarkers'

import { fuseauUtilisable, journeeDans } from '~~/shared/utils/fuseau-edition'

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

  /**
   * La plage de dates d'une édition, dans SON fuseau.
   *
   * ⚠️ `getMonth()`, `getFullYear()` et `getDate()` lisaient dans le fuseau du NAVIGATEUR : une
   * édition du 1er au 3 août, heure locale, pouvait s'annoncer « 31 juillet - 2 août » à un
   * lecteur situé plus à l'ouest. Les trois comparaisons passent donc par `journeeDans`, qui
   * découpe la journée sur le lieu de l'événement.
   *
   * 📍 LE REPLI EST VOLONTAIREMENT LA MACHINE, et non `Europe/Paris` comme dans `useDateFormat` :
   * cette fonction n'a jamais posé de fuseau, donc elle a toujours lu celui du lecteur. Lui en
   * imposer un autre aujourd'hui changerait l'affichage des éditions sans fuseau — plus de la
   * moitié d'entre elles — sans que personne l'ait demandé. Chaque surface garde son repli
   * d'origine ; seules les éditions qui DÉCLARENT un fuseau changent, et vers le bon.
   */
  const formatDateRangeLocal = (
    startDate: string,
    endDate: string,
    fuseau?: string | null
  ): string => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const loc = locale.value
    const zone = fuseauUtilisable(fuseau)
    const opts: Intl.DateTimeFormatOptions = {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: zone,
    }
    if (start.getTime() === end.getTime()) return start.toLocaleDateString(loc, opts)

    const [anneeDebut, moisDebut, jourDebut] = journeeDans(start, fuseau).split('-')
    const [anneeFin, moisFin] = journeeDans(end, fuseau).split('-')

    if (moisDebut === moisFin && anneeDebut === anneeFin) {
      return `${Number(jourDebut)} - ${end.toLocaleDateString(loc, opts)}`
    }
    if (anneeDebut === anneeFin) {
      const startOpts: Intl.DateTimeFormatOptions = {
        day: 'numeric',
        month: 'long',
        timeZone: zone,
      }
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
        dateRange: formatDateRangeLocal(edition.startDate, edition.endDate, edition.timezone),
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
