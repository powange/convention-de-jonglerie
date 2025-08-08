<template>
  <div class="space-y-4">
    <!-- Badge des éditions -->
    <div v-if="editionsWithCoordinates.length > 0" class="flex justify-between items-center mb-4">
      <UBadge :color="'primary'" variant="soft">
        {{ $t('components.map.editions_on_map', { count: editionsWithCoordinates.length }) }}
      </UBadge>
      <p class="text-sm text-gray-500">
        {{ editions.length - editionsWithCoordinates.length > 0 ? $t('components.map.without_coordinates', { count: editions.length - editionsWithCoordinates.length }) : '' }}
      </p>
    </div>

    <!-- Message si aucune édition avec coordonnées -->
    <div v-if="editionsWithCoordinates.length === 0" class="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <UIcon name="i-heroicons-map-pin" class="mx-auto h-12 w-12 text-gray-400 mb-3" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">{{ $t('components.map.no_editions_with_location') }}</h3>
      <p class="text-gray-600 dark:text-gray-400">{{ $t('components.map.incomplete_address_warning') }}</p>
    </div>

    <!-- Conteneur de la carte -->
    <div v-else class="relative">
      <div ref="mapContainer" class="h-[600px] rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <!-- Message de chargement -->
        <div v-if="!mapReady" class="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800">
          <div class="text-center">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin text-primary-500 mx-auto mb-2" size="24" />
            <p class="text-sm text-gray-600 dark:text-gray-400">{{ $t('components.map.loading') }}</p>
          </div>
        </div>
      </div>
      
      <!-- Légende et contrôles -->
      <div class="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[1000] space-y-2">
        <div class="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">{{ $t('components.map.temporal_status') }} :</div>
        <div class="flex items-center gap-2 text-sm">
          <div class="w-3 h-3 bg-green-500 rounded-full"></div>
          <span class="text-gray-700 dark:text-gray-300">{{ $t('components.map.ongoing') }}</span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <div class="w-3 h-3 bg-blue-500 rounded-full"></div>
          <span class="text-gray-700 dark:text-gray-300">{{ $t('components.map.upcoming') }}</span>
        </div>
        <div class="flex items-center gap-2 text-sm">
          <div class="w-3 h-3 bg-gray-500 rounded-full"></div>
          <span class="text-gray-700 dark:text-gray-300">{{ $t('components.map.past') }}</span>
        </div>
        <div v-if="authStore.isAuthenticated" class="pt-2 border-t border-gray-200 dark:border-gray-600">
          <div class="flex items-center gap-2 text-sm">
            <div class="w-3 h-3 rounded-full border-2 border-yellow-500 bg-transparent"></div>
            <span class="text-gray-700 dark:text-gray-300">{{ $t('components.map.yellow_border_favorite') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Edition } from '~/types';
import { getEditionDisplayName } from '~/utils/editionName';
import { useAuthStore } from '~/stores/auth';
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
const authStore = useAuthStore();
const { t, locale } = useI18n();

// Références
const mapContainer = ref<HTMLElement>();
const mapReady = ref(false);
let map: any = null;
let leaflet: any = null;

// Filtrer les éditions avec coordonnées
const editionsWithCoordinates = computed(() => {
  return props.editions.filter(edition => 
    edition.latitude !== null && edition.longitude !== null
  );
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

// Vérifier si l'utilisateur a mis en favori cette édition
const isFavorited = (edition: Edition): boolean => {
  if (!authStore.user?.id) return false;
  return edition.favoritedBy.some(user => user.id === authStore.user?.id);
};

// Initialiser la carte
const initMap = async () => {
  if (!mapContainer.value || editionsWithCoordinates.value.length === 0) return;

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
    const now = new Date();

    // Ajouter un marqueur pour chaque édition
    editionsWithCoordinates.value.forEach(edition => {
      if (edition.latitude && edition.longitude) {
        const isFav = isFavorited(edition);
        const status = getEditionStatus(edition.startDate, edition.endDate);
        
        // Créer l'icône personnalisée
        const icon = createCustomMarkerIcon(L, {
          isUpcoming: status.isUpcoming,
          isOngoing: status.isOngoing,
          isFavorite: isFav
        });

        const marker = L.marker([edition.latitude, edition.longitude], { icon });
        
        // Créer le contenu du popup
        const popupContent = `
          <div class="p-3 min-w-[250px]">
            ${edition.imageUrl ? `<img src="${edition.imageUrl}" alt="${getEditionDisplayName(edition)}" class="w-full h-32 object-cover rounded mb-3">` : ''}
            <div class="flex items-start justify-between gap-2 mb-2">
              <h4 class="font-semibold text-gray-900">${getEditionDisplayName(edition)}</h4>
              ${isFav ? `<span class="text-yellow-500" title="${t('common.favorite')}">★</span>` : ''}
            </div>
            <p class="text-sm text-gray-600 mb-1">${edition.city}, ${edition.country}</p>
            <p class="text-xs text-gray-500 mb-3">${formatDateRange(edition.startDate, edition.endDate)}</p>
            ${edition.description ? `<p class="text-xs text-gray-600 mb-3 line-clamp-2">${edition.description}</p>` : ''}
            <a href="/editions/${edition.id}" class="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {{ t('common.view_details') }}
            </a>
          </div>
        `;
        
        marker.bindPopup(popupContent, {
          maxWidth: 300,
          minWidth: 250
        });
        
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
          padding: [50, 50],
          maxZoom: 12
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
const formatDateRange = (startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Utiliser la locale définie au top-level
  const localeCode = locale.value === 'fr' ? 'fr-FR' : 
                     locale.value === 'en' ? 'en-US' :
                     locale.value === 'es' ? 'es-ES' :
                     locale.value === 'de' ? 'de-DE' :
                     locale.value === 'it' ? 'it-IT' :
                     locale.value === 'pt' ? 'pt-PT' :
                     locale.value === 'da' ? 'da-DK' :
                     locale.value === 'pl' ? 'pl-PL' : 'fr-FR';
  
  if (start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString(localeCode, { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  }
  
  return `${start.toLocaleDateString(localeCode, { 
    day: 'numeric', 
    month: 'short' 
  })} - ${end.toLocaleDateString(localeCode, { 
    day: 'numeric', 
    month: 'short', 
    year: 'numeric' 
  })}`;
};

// Lifecycle
onMounted(() => {
  nextTick(() => {
    if (editionsWithCoordinates.value.length > 0) {
      initMap();
    }
  });
});

onUnmounted(() => {
  cleanupMap();
});

// Watcher pour réinitialiser la carte quand les données changent
watch(() => editionsWithCoordinates.value, (newEditions) => {
  cleanupMap();
  if (newEditions.length > 0) {
    nextTick(() => {
      initMap();
    });
  }
}, { deep: true });
</script>

<style scoped>
/* Force la hauteur minimale de la carte sur mobile */
@media (max-width: 640px) {
  [ref="mapContainer"] {
    min-height: 400px;
  }
}
</style>