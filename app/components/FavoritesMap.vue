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
        <div v-if="!mapReady" class="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800">
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
          <div class="w-3 h-3 bg-green-500 rounded-full"></div>
          <span class="text-gray-700 dark:text-gray-300">{{ $t('components.map.ongoing') }}</span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <div class="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span class="text-gray-700 dark:text-gray-300">{{ $t('components.favorites_map.upcoming') }}</span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <div class="w-3 h-3 bg-gray-500 rounded-full"></div>
          <span class="text-gray-700 dark:text-gray-300">{{ $t('components.favorites_map.past') }}</span>
        </div>
        <div class="pt-2 border-t border-gray-200 dark:border-gray-600">
          <div class="flex items-center gap-2 text-sm">
            <div class="w-3 h-3 rounded-full border-2 border-yellow-500 bg-transparent"></div>
            <span class="text-gray-700 dark:text-gray-300">{{ $t('components.favorites_map.all_favorites') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Edition } from '~/types';
import { getEditionDisplayName } from '~/utils/editionName';
import { createCustomMarkerIcon, getEditionStatus } from '~/utils/mapMarkers';

// Déclaration de type pour Leaflet global
declare global {
  interface Window {
    L: any;
  }
}

interface Props {
  editions: Edition[];
}

const props = defineProps<Props>();
const { t } = useI18n();

// Références
const mapContainer = ref<HTMLElement>();
const mapReady = ref(false);
let map: any = null;
let leaflet: any = null;

// Filtrer les éditions favorites à venir avec coordonnées
const upcomingFavorites = computed(() => {
  const now = new Date();
  return props.editions.filter(edition => {
    const startDate = new Date(edition.startDate);
    return startDate >= now && edition.latitude && edition.longitude;
  });
});

// Charger Leaflet dynamiquement (côté client uniquement)
const loadLeaflet = async () => {
  if (process.server) return;
  
  // Si Leaflet est déjà chargé, le retourner directement
  if (window.L) {
    return window.L;
  }
  
  try {
    // Vérifier si le CSS est déjà chargé
    const existingLink = document.querySelector('link[href*="leaflet.css"]');
    if (!existingLink) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Vérifier si le script est déjà chargé
    const existingScript = document.querySelector('script[src*="leaflet.js"]');
    if (existingScript && window.L) {
      return window.L;
    }

    // Charger Leaflet depuis le CDN
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    
    return new Promise((resolve, reject) => {
      script.onload = () => {
        const L = window.L;
        if (L) {
          resolve(L);
        } else {
          reject(new Error(t('errors.leaflet_unavailable')));
        }
      };
      script.onerror = () => reject(new Error(t('errors.leaflet_loading_error')));
      document.head.appendChild(script);
    });
    
  } catch (error) {
    console.error('Erreur lors du chargement de Leaflet:', error);
    return null;
  }
};

// Initialiser la carte
const initMap = async () => {
  if (!mapContainer.value || upcomingFavorites.value.length === 0) return;

  const L = await loadLeaflet();
  if (!L) return;

  try {
    // Créer la carte
    map = L.map(mapContainer.value, {
      zoomControl: true,
      attributionControl: true
    });

    // Ajouter les tuiles OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19
    }).addTo(map);

    // Créer un groupe pour tous les marqueurs
    const markers: any[] = [];

    // Ajouter un marqueur pour chaque édition
    upcomingFavorites.value.forEach(edition => {
      if (edition.latitude && edition.longitude) {
        const status = getEditionStatus(edition.startDate, edition.endDate);
        
        // Créer l'icône personnalisée (toutes les éditions sont favorites ici)
        const icon = createCustomMarkerIcon(L, {
          isUpcoming: status.isUpcoming,
          isOngoing: status.isOngoing,
          isFavorite: true // Toutes les éditions dans favoris sont favorites
        });

        const marker = L.marker([edition.latitude, edition.longitude], { icon });
        
        // Créer le contenu du popup
        const popupContent = `
          <div class="p-2 min-w-[200px]">
            <h4 class="font-semibold text-gray-900 mb-1">${getEditionDisplayName(edition)}</h4>
            <p class="text-sm text-gray-600 mb-2">${edition.city}, ${edition.country}</p>
            <p class="text-xs text-gray-500 mb-2">${formatDateRange(edition.startDate, edition.endDate)}</p>
            <a href="/editions/${edition.id}" class="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Voir les détails
            </a>
          </div>
        `;
        
        marker.bindPopup(popupContent);
        markers.push(marker);
        marker.addTo(map);
      }
    });

    // Ajuster la vue pour inclure tous les marqueurs
    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      const bounds = group.getBounds();
      
      if (bounds.isValid()) {
        map.fitBounds(bounds, { 
          padding: [20, 20],
          maxZoom: 10
        });
      }
    }

    mapReady.value = true;
  } catch (error) {
    console.error('Erreur lors de l\'initialisation de la carte:', error);
  }
};

// Nettoyer la carte
const cleanupMap = () => {
  if (map) {
    map.remove();
    map = null;
  }
  mapReady.value = false;
};

// Utilitaires
const { formatDateTimeRange } = useDateFormat();

const formatDateRange = (startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString('fr-FR', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  }
  
  return `${start.toLocaleDateString('fr-FR', { 
    day: 'numeric', 
    month: 'short' 
  })} - ${end.toLocaleDateString('fr-FR', { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  })}`;
};

// Lifecycle
onMounted(() => {
  nextTick(() => {
    if (upcomingFavorites.value.length > 0) {
      initMap();
    }
  });
});

onUnmounted(() => {
  cleanupMap();
});

// Watcher pour réinitialiser la carte quand les données changent
watch(() => upcomingFavorites.value, (newFavorites) => {
  cleanupMap();
  if (newFavorites.length > 0) {
    nextTick(() => {
      initMap();
    });
  }
}, { deep: true });
</script>

<style scoped>
/* Styles supplémentaires pour la carte si nécessaire */
</style>