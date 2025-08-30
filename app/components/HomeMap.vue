<template>
  <div class="space-y-4">
    <!-- Badge des éditions -->
    <div v-if="editionsWithCoordinates.length > 0" class="flex justify-between items-center mb-4">
      <UBadge :color="'primary'" variant="soft">
        {{ $t('components.map.editions_on_map', { count: editionsWithCoordinates.length }) }}
      </UBadge>
      <p class="text-sm text-gray-500">
        {{
          editions.length - editionsWithCoordinates.length > 0
            ? $t('components.map.without_coordinates', {
                count: editions.length - editionsWithCoordinates.length,
              })
            : ''
        }}
      </p>
    </div>

    <!-- Message si aucune édition avec coordonnées -->
    <div
      v-if="editionsWithCoordinates.length === 0"
      class="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg"
    >
      <UIcon name="i-heroicons-map-pin" class="mx-auto h-12 w-12 text-gray-400 mb-3" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ $t('components.map.no_editions_with_location') }}
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        {{ $t('components.map.incomplete_address_warning') }}
      </p>
    </div>

    <!-- Conteneur de la carte -->
    <div v-else class="relative">
      <div
        ref="mapContainer"
        class="h-[600px] rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
      >
        <!-- Message de chargement -->
        <div
          v-if="isLoading"
          class="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800"
        >
          <div class="text-center">
            <UIcon
              name="i-heroicons-arrow-path"
              class="animate-spin text-primary-500 mx-auto mb-2"
              size="24"
            />
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('components.map.loading') }}
            </p>
          </div>
        </div>
      </div>

      <!-- Légende et contrôles -->
      <div
        class="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[1000] space-y-2"
      >
        <div class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
          {{ $t('components.map.temporal_status') }} :
        </div>
        <div class="flex items-center gap-2 text-sm">
          <div class="w-3 h-3 bg-green-500 rounded-full" />
          <span class="text-gray-700 dark:text-gray-300">{{ $t('components.map.ongoing') }}</span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <div class="w-3 h-3 bg-blue-500 rounded-full" />
          <span class="text-gray-700 dark:text-gray-300">{{ $t('components.map.upcoming') }}</span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <div class="w-3 h-3 bg-gray-500 rounded-full" />
          <span class="text-gray-700 dark:text-gray-300">{{ $t('components.map.past') }}</span>
        </div>
        <div
          v-if="authStore.isAuthenticated"
          class="pt-2 border-t border-gray-200 dark:border-gray-600"
        >
          <div class="flex items-center gap-2 text-sm">
            <div class="w-3 h-3 rounded-full border-2 border-yellow-500 bg-transparent" />
            <span class="text-gray-700 dark:text-gray-300">{{
              $t('components.map.yellow_border_favorite')
            }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MapMarker } from '~/composables/useLeafletMap'
import { useAuthStore } from '~/stores/auth'
import type { Edition } from '~/types'
import { getEditionDisplayName } from '~/utils/editionName'
import { createCustomMarkerIcon, getEditionStatus } from '~/utils/mapMarkers'

interface Props {
  editions: Edition[]
}

const props = defineProps<Props>()
const authStore = useAuthStore()
const { t } = useI18n()

// Utilitaire local pour éviter une dépendance circulaire avec mapUtils
const formatDateRangeLocal = (startDate: string, endDate: string) => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  if (start.getTime() === end.getTime()) return start.toLocaleDateString('fr-FR', options)
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} - ${end.toLocaleDateString('fr-FR', options)}`
  }
  if (start.getFullYear() === end.getFullYear()) {
    const startOptions: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }
    return `${start.toLocaleDateString('fr-FR', startOptions)} - ${end.toLocaleDateString('fr-FR', options)}`
  }
  return `${start.toLocaleDateString('fr-FR', options)} - ${end.toLocaleDateString('fr-FR', options)}`
}

// Références
const mapContainer = ref<HTMLElement | null>(null)

// Filtrer les éditions avec coordonnées
const editionsWithCoordinates = computed(() => {
  return props.editions.filter((edition) => edition.latitude !== null && edition.longitude !== null)
})

// Vérifier si l'utilisateur a mis en favori cette édition
const isFavorited = (edition: Edition): boolean => {
  if (!authStore.user?.id) return false
  return edition.favoritedBy.some((user) => user.id === authStore.user?.id)
}

// Fonction pour créer les marqueurs (appelée quand Leaflet est disponible)
const createMarkers = (): MapMarker[] => {
  if (!import.meta.client || !(window as any).L) return []

  return editionsWithCoordinates.value.map((edition) => {
    const isFav = isFavorited(edition)
    const status = getEditionStatus(edition.startDate, edition.endDate)
    const Lany = (window as any).L as any

    // Créer l'icône personnalisée
    const icon = createCustomMarkerIcon(Lany, {
      isUpcoming: status.isUpcoming,
      isOngoing: status.isOngoing,
      isFavorite: isFav,
    })

    // Créer le contenu du popup
    const popupContent = `
      <div class="p-3 min-w-[250px]">
        ${edition.imageUrl ? `<img src="${edition.imageUrl}" alt="${getEditionDisplayName(edition)}" class="w-full h-32 object-cover rounded mb-3">` : ''}
        <div class="flex items-start justify-between gap-2 mb-2">
          <h4 class="font-semibold text-gray-900">${getEditionDisplayName(edition)}</h4>
          ${isFav ? `<span class="text-yellow-500" title="${t('common.favorite')}">★</span>` : ''}
        </div>
        <p class="text-sm text-gray-600 mb-1">${edition.city}, ${edition.country}</p>
  <p class="text-xs text-gray-500 mb-3">${formatDateRangeLocal(edition.startDate, edition.endDate)}</p>
        ${edition.description ? `<p class="text-xs text-gray-600 mb-3 line-clamp-2">${edition.description}</p>` : ''}
        <a href="/editions/${edition.id}" class="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002 2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          ${t('common.view_details')}
        </a>
      </div>
    `

    return {
      id: edition.id,
      position: [edition.latitude!, edition.longitude!] as [number, number],
      popupContent,
      icon,
    }
  })
}

// Utiliser le composable uniquement côté client (sans marqueurs initiaux)
const mapUtils = import.meta.client
  ? useLeafletMap(mapContainer, {
      center: [46.603354, 1.888334],
      zoom: 6,
      markers: [], // Pas de marqueurs initiaux
    })
  : {
      isLoading: ref(false),
      formatDateRange: (_start: string, _end: string) => '',
      // no-op stubs to align types during SSR
      addMarkers: (_m: MapMarker[]) => {},
      clearMarkers: () => {},
      updateMarkers: (_m: MapMarker[]) => {},
      fitBounds: (_b: any, _o?: any) => {},
      setView: (_c: any, _z?: number) => {},
    }

const { isLoading } = mapUtils

// Fonction pour vérifier et ajouter les marqueurs
const tryAddMarkers = () => {
  if ((window as any).L && editionsWithCoordinates.value.length > 0) {
    const markers = createMarkers()
    if (markers.length > 0 && mapUtils.updateMarkers) {
      mapUtils.updateMarkers(markers)
      
      // Ajuster la vue pour montrer tous les marqueurs
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

// Polling pour détecter quand Leaflet est disponible
if (import.meta.client) {
  const checkLeafletInterval = setInterval(() => {
    if ((window as any).L) {
      if (tryAddMarkers()) {
        clearInterval(checkLeafletInterval)
      }
    }
  }, 100) // Vérifier toutes les 100ms
  
  // Nettoyer l'interval après 10 secondes pour éviter les fuites mémoire
  setTimeout(() => {
    clearInterval(checkLeafletInterval)
  }, 10000)

  // Watcher pour les changements d'éditions (filtres, etc.)
  watch(editionsWithCoordinates, () => {
    // Seulement si Leaflet est disponible
    if ((window as any).L) {
      tryAddMarkers()
    }
  })
}
</script>

<style scoped>
/* Force la hauteur minimale de la carte sur mobile */
@media (max-width: 640px) {
  [ref='mapContainer'] {
    min-height: 400px;
  }
}
</style>
