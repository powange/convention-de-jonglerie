<template>
  <div>
    <div v-if="loading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary" />
    </div>

    <div v-else-if="!edition">
      <UAlert
        icon="i-lucide-alert-triangle"
        color="error"
        variant="soft"
        :title="$t('edition.not_found')"
      />
    </div>

    <div v-else class="space-y-6">
      <!-- En-tête avec navigation -->
      <EditionHeader :edition="edition" current-page="map" />

      <!-- Message si pas de zones ni de markers -->
      <UAlert
        v-if="zones.length === 0 && markers.length === 0"
        icon="i-lucide-map"
        color="info"
        variant="soft"
        :title="$t('gestion.map.no_items')"
      />

      <!-- Contenu principal -->
      <div
        v-if="zones.length > 0 || markers.length > 0"
        class="grid grid-cols-1 gap-6 lg:grid-cols-3"
      >
        <!-- Carte -->
        <div class="lg:col-span-2 relative z-0">
          <UCard>
            <div ref="mapContainerRef" class="h-[500px] w-full rounded-lg" />
          </UCard>
        </div>

        <!-- Légende -->
        <div class="space-y-4">
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-layers" class="h-5 w-5" />
                <h2 class="font-semibold">{{ $t('gestion.map.zones_list') || 'Zones' }}</h2>
              </div>
            </template>

            <ZonesLegend
              :zones="zones"
              :markers="markers"
              :editable="false"
              @focus="handleFocusZone"
              @focus-marker="handleFocusMarker"
              @toggle-visibility="handleToggleVisibility"
            />
          </UCard>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ZonesLegend from '~/components/edition/zones/ZonesLegend.vue'
import type { EditionMarker } from '~/composables/useEditionMarkers'
import type { EditionZone } from '~/composables/useEditionZones'
import { useEditionStore } from '~/stores/editions'
import { getEditionDisplayName } from '~/utils/editionName'

const route = useRoute()
const { t } = useI18n()
const editionStore = useEditionStore()

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))

// Métadonnées SEO
const editionName = computed(() => (edition.value ? getEditionDisplayName(edition.value) : ''))

const seoTitle = computed(() => {
  if (!edition.value) return t('edition.map')
  return `${t('edition.map')} - ${editionName.value}`
})

const seoDescription = computed(() => {
  if (!edition.value) return ''
  return `${t('edition.map')} - ${editionName.value}, ${edition.value.city || ''}`
})

useSeoMeta({
  title: seoTitle,
  description: seoDescription,
})
const loading = computed(() => editionStore.loading)

// Zones
const { zones } = useEditionZones(editionId)

// Markers
const { markers } = useEditionMarkers(editionId)

// Map (mode lecture seule)
const mapContainerRef = ref<HTMLElement | null>(null)

// Flag pour ne centrer la carte qu'une seule fois (évite le recentrage après navigation utilisateur)
const initialViewSet = ref(false)

const {
  map,
  addZones,
  addMarkers,
  setView,
  focusOnZone,
  focusOnMarker,
  showZone,
  hideZone,
  showMarker,
  hideMarker,
} = useLeafletEditable(mapContainerRef, {
  center: computed(() => {
    if (edition.value?.latitude && edition.value?.longitude) {
      return [edition.value.latitude, edition.value.longitude]
    }
    return [46.603354, 1.888334]
  }).value,
  zoom: edition.value?.latitude ? 15 : 6,
  editable: false,
})

// Ajouter les zones à la carte quand elles sont chargées ET que la carte est prête
// Note: addZones vérifie déjà les doublons via polygons.value.has(zone.id)
watch(
  [zones, map],
  ([newZones, newMap]) => {
    if (newMap && newZones.length > 0) {
      addZones(
        newZones.map((z) => ({
          id: z.id,
          name: z.name,
          description: z.description,
          color: z.color,
          coordinates: z.coordinates,
          zoneType: z.zoneType,
          order: z.order,
        }))
      )
    }
  },
  { immediate: true }
)

// Ajouter les markers à la carte quand ils sont chargés ET que la carte est prête
// Note: addMarkers vérifie déjà les doublons via leafletMarkers.value.has(marker.id)
watch(
  [markers, map],
  ([newMarkers, newMap]) => {
    if (newMap && newMarkers.length > 0) {
      addMarkers(
        newMarkers.map((m) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          latitude: m.latitude,
          longitude: m.longitude,
          markerType: m.markerType,
          color: m.color,
          order: m.order,
        }))
      )
    }
  },
  { immediate: true }
)

// Charger l'édition si nécessaire
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId.value, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
})

// Centrer sur l'édition quand elle est chargée ET que la carte est prête (une seule fois)
watch(
  [edition, map],
  ([newEdition, newMap]) => {
    if (!initialViewSet.value && newMap && newEdition?.latitude && newEdition?.longitude) {
      setView([newEdition.latitude, newEdition.longitude], 15)
      initialViewSet.value = true
    }
  },
  { immediate: true }
)

const handleFocusZone = (zone: EditionZone) => {
  focusOnZone(zone.id)
}

const handleFocusMarker = (marker: EditionMarker) => {
  focusOnMarker(marker.id)
}

const handleToggleVisibility = (item: {
  id: number
  type: 'zone' | 'marker'
  visible: boolean
}) => {
  if (item.type === 'zone') {
    if (item.visible) {
      showZone(item.id)
    } else {
      hideZone(item.id)
    }
  } else {
    if (item.visible) {
      showMarker(item.id)
    } else {
      hideMarker(item.id)
    }
  }
}
</script>

<style scoped>
/* Styles pour les icônes de marqueurs personnalisés */
:deep(.custom-marker-icon) {
  background: transparent !important;
  border: none !important;
}

:deep(.marker-icon) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: white;
  border-radius: 50%;
  border: 2px solid;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

:deep(.marker-icon svg) {
  width: 16px;
  height: 16px;
}
</style>
