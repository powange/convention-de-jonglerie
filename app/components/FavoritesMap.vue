<template>
  <div class="space-y-4">
    <!-- En-tête de la carte -->
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold flex items-center gap-2">
        <UIcon name="i-heroicons-map" class="text-primary-500" />
        Carte des favoris à venir
      </h3>
      <UBadge v-if="upcomingFavorites.length > 0" :color="'primary'" variant="soft">
        {{ upcomingFavorites.length }} édition{{ upcomingFavorites.length > 1 ? 's' : '' }}
      </UBadge>
    </div>

    <!-- Message si aucune édition avec coordonnées -->
    <div v-if="upcomingFavorites.length === 0" class="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <UIcon name="i-heroicons-map-pin" class="mx-auto h-8 w-8 text-gray-400 mb-2" />
      <p class="text-gray-600 dark:text-gray-400">Aucune édition favorite à venir avec localisation disponible</p>
    </div>

    <!-- Conteneur de la carte -->
    <div v-else class="relative">
      <div ref="mapContainer" class="h-96 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <!-- Message de chargement -->
        <div v-if="!mapReady" class="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800">
          <div class="text-center">
            <UIcon name="i-heroicons-arrow-path" class="animate-spin text-primary-500 mx-auto mb-2" size="24" />
            <p class="text-sm text-gray-600 dark:text-gray-400">Chargement de la carte...</p>
          </div>
        </div>
      </div>
      
      <!-- Légende -->
      <div class="absolute top-4 right-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-[1000]">
        <div class="flex items-center gap-2 text-sm">
          <div class="w-3 h-3 bg-red-500 rounded-full"></div>
          <span class="text-gray-700 dark:text-gray-300">Éditions favorites</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Edition } from '~/types';
import { getEditionDisplayName } from '~/utils/editionName';

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
          reject(new Error('Leaflet non disponible'));
        }
      };
      script.onerror = () => reject(new Error('Erreur de chargement de Leaflet'));
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
        // Créer une icône personnalisée rouge
        const redIcon = L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
          iconRetinaUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
          popupAnchor: [1, -34],
          shadowSize: [41, 41]
        });

        const marker = L.marker([edition.latitude, edition.longitude], { icon: redIcon });
        
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