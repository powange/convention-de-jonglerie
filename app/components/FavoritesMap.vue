<template>
  <div class="space-y-4">
    <!-- Badge des éditions -->
    <div v-if="upcomingFavorites.length > 0" class="flex justify-end mb-4">
      <UBadge :color="'primary'" variant="soft">
        {{ $t('components.favorites_map.editions_with_location', { count: upcomingFavorites.length }) }}
      </UBadge>
    </div>

    <!-- Message si aucune édition avec coordonnées -->
    <div v-if="upcomingFavorites.length === 0" class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <UIcon name="i-heroicons-map-pin" class="mx-auto h-8 w-8 text-gray-400 mb-2" />
      <p class="text-gray-600 dark:text-gray-400">{{ $t('components.favorites_map.no_upcoming_favorites') }}</p>
    </div>

    <!-- Conteneur de la carte -->
    <div v-else class="relative">
      <div ref="mapContainer" class="h-96 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <!-- Message de chargement -->
        <div v-if="isLoading" class="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800">
          <div class="text-center">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin text-primary-500 mx-auto mb-2" size="24" />
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ $t('components.map.loading') }}</p>
          </div>
        </div>
      </div>
      
      <!-- Légende -->
      <div class="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[1000] space-y-2">
        <div class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">{{ $t('components.map.temporal_status') }} :</div>
        <div class="flex items-center gap-2 text-sm">
          <div class="w-3 h-3 bg-green-500 rounded-full"/>
          <span class="text-gray-700 dark:text-gray-300">{{ $t('components.map.ongoing') }}</span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <div class="w-3 h-3 bg-blue-500 rounded-full"/>
          <span class="text-gray-700 dark:text-gray-300">{{ $t('components.favorites_map.upcoming') }}</span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <div class="w-3 h-3 bg-gray-500 rounded-full"/>
          <span class="text-gray-700 dark:text-gray-300">{{ $t('components.favorites_map.past') }}</span>
        </div>
        <div class="pt-2 border-t border-gray-200 dark:border-gray-600">
          <div class="flex items-center gap-2 text-sm">
            <div class="w-3 h-3 rounded-full border-2 border-yellow-500 bg-transparent"/>
            <span class="text-gray-700 dark:text-gray-300">{{ $t('components.favorites_map.all_favorites') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Edition } from '~/types';
import type { MapMarker } from '~/composables/useLeafletMap';
import { getEditionDisplayName } from '~/utils/editionName';
import { createCustomMarkerIcon, getEditionStatus } from '~/utils/mapMarkers';

interface Props {
  editions: Edition[];
}

const props = defineProps<Props>();
const { t } = useI18n();

// Références
const mapContainer = ref<HTMLElement | null>(null);

// Utilitaire local pour formater les dates (évite de référencer mapUtils depuis markers)
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

// Filtrer les éditions favorites à venir avec coordonnées
const upcomingFavorites = computed(() => {
  const now = new Date();
  return props.editions.filter(edition => {
    const startDate = new Date(edition.startDate);
    return startDate >= now && edition.latitude && edition.longitude;
  });
});

// Préparer les marqueurs pour le composable
const markers = computed<MapMarker[]>(() => {
  if (!import.meta.client || !(window as any).L) return [];
  
  return upcomingFavorites.value.map(edition => {
    const status = getEditionStatus(edition.startDate, edition.endDate);
    const Lany = (window as any).L as any;
    
    // Créer l'icône personnalisée - tous les favoris ont isFavorite: true
    const icon = createCustomMarkerIcon(Lany, {
      isUpcoming: status.isUpcoming,
      isOngoing: status.isOngoing,
      isFavorite: true
    });

    // Créer le contenu du popup
    const popupContent = `
      <div class="p-3 min-w-[200px]">
        ${edition.imageUrl ? `<img src="${edition.imageUrl}" alt="${getEditionDisplayName(edition)}" class="w-full h-24 object-cover rounded mb-2">` : ''}
        <div class="flex items-start justify-between gap-2 mb-1">
          <h4 class="font-semibold text-gray-900 text-sm">${getEditionDisplayName(edition)}</h4>
          <span class="text-yellow-500 text-sm" title="${t('common.favorite')}">★</span>
        </div>
        <p class="text-xs text-gray-600 mb-1">${edition.city}, ${edition.country}</p>
  <p class="text-xs text-gray-500 mb-2">${formatDateRangeLocal(edition.startDate, edition.endDate)}</p>
        <a href="/editions/${edition.id}" class="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          ${t('common.view_details')}
        </a>
      </div>
    `;

    return {
      id: edition.id,
      position: [edition.latitude!, edition.longitude!] as [number, number],
      popupContent,
      icon
    };
  });
});

// Utiliser le composable uniquement côté client
const mapUtils = import.meta.client ? useLeafletMap(mapContainer, {
  center: [46.603354, 1.888334],
  zoom: 6,
  markers: markers.value
}) : {
  isLoading: ref(false),
  formatDateRange: (_start: string, _end: string) => '',
  // stubs SSR pour correspondre à l'API du composable
  addMarkers: (_m: MapMarker[]) => {},
  clearMarkers: () => {},
  updateMarkers: (_m: MapMarker[]) => {},
  fitBounds: (_b: any, _o?: any) => {},
  setView: (_c: any, _z?: number) => {},
};

const { isLoading } = mapUtils;

// Watcher pour mettre à jour les marqueurs
if (import.meta.client) {
  watch(markers, (newMarkers) => {
    if (mapUtils.updateMarkers) {
      mapUtils.updateMarkers(newMarkers);
    }
    
    // Ajuster la vue si nécessaire
    if (newMarkers.length > 0 && mapUtils.fitBounds && (window as any).L) {
      const Lany = (window as any).L as any;
      const bounds = newMarkers.map(m => m.position);
      const leafletBounds = Lany.latLngBounds(bounds);
      mapUtils.fitBounds(leafletBounds.pad(0.1));
    }
  });
}
</script>