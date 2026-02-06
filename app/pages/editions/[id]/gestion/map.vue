<template>
  <div>
    <!-- Loading initial -->
    <div v-if="initialLoading" class="flex items-center justify-center py-12">
      <UIcon name="i-lucide-loader-2" class="h-8 w-8 animate-spin text-primary" />
    </div>

    <!-- Erreur : édition non trouvée -->
    <div v-else-if="!edition">
      <UAlert
        icon="i-lucide-alert-triangle"
        color="error"
        variant="soft"
        :title="$t('edition.not_found')"
      />
    </div>

    <!-- Erreur : accès refusé -->
    <div v-else-if="!canEdit">
      <UAlert
        icon="i-lucide-shield-alert"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>

    <!-- Contenu principal -->
    <div v-else class="space-y-6">
      <!-- En-tête -->
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 class="text-2xl font-bold">{{ $t('gestion.map.title') }}</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('gestion.map.click_to_draw') }}
          </p>
        </div>

        <div class="flex items-center gap-4">
          <!-- Toggle publication carte -->
          <USwitch
            v-model="mapPublic"
            :label="$t('gestion.map.map_public')"
            :loading="updatingMapPublic"
            @update:model-value="handleMapPublicChange"
          />

          <div class="flex gap-2">
            <!-- Zone drawing buttons -->
            <UButton
              v-if="!isDrawing && !isPlacingMarker"
              icon="i-lucide-pentagon"
              :label="$t('gestion.map.draw_polygon')"
              @click="startDrawingNewZone"
            />
            <UButton
              v-else-if="isDrawing"
              icon="i-lucide-x"
              color="neutral"
              variant="outline"
              :label="$t('gestion.map.stop_drawing')"
              @click="cancelDrawing"
            />

            <!-- Marker placement buttons -->
            <UButton
              v-if="!isDrawing && !isPlacingMarker"
              icon="i-lucide-map-pin"
              color="neutral"
              variant="outline"
              :label="$t('gestion.map.place_marker')"
              @click="startPlacingNewMarker"
            />
            <UButton
              v-else-if="isPlacingMarker"
              icon="i-lucide-x"
              color="neutral"
              variant="outline"
              :label="$t('gestion.map.stop_placing')"
              @click="cancelPlacingMarker"
            />
          </div>
        </div>
      </div>

      <!-- Contenu principal -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- Carte -->
        <div class="lg:col-span-2">
          <UCard>
            <div ref="mapContainerRef" class="h-[500px] w-full rounded-lg cursor-crosshair" />
          </UCard>
        </div>

        <!-- Légende / Liste des zones -->
        <div>
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
              :editable="true"
              :loading="deleting || deletingMarker"
              @edit="handleEditZone"
              @delete="handleDeleteZone"
              @focus="handleFocusZone"
              @edit-marker="handleEditMarker"
              @delete-marker="handleDeleteMarker"
              @focus-marker="handleFocusMarker"
            />
          </UCard>
        </div>
      </div>
    </div>

    <!-- Modal création/édition zone -->
    <ZoneModal
      :open="modalOpen"
      :zone="editingZone"
      :loading="creating || updating"
      @close="closeModal"
      @save="handleSaveZone"
    />

    <!-- Modal création/édition marker -->
    <MarkerModal
      :open="markerModalOpen"
      :marker="editingMarker"
      :loading="creatingMarker || updatingMarker"
      @close="closeMarkerModal"
      @save="handleSaveMarker"
    />

    <!-- Modal confirmation suppression zone -->
    <UModal
      :open="deleteConfirmOpen"
      :title="$t('common.confirm_delete')"
      @update:open="(v: boolean) => !v && (deleteConfirmOpen = false)"
    >
      <template #body>
        <p>{{ $t('gestion.map.delete_confirm') }}</p>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('common.cancel')"
            @click="deleteConfirmOpen = false"
          />
          <UButton
            color="error"
            :label="$t('common.delete')"
            :loading="deleting"
            @click="confirmDelete"
          />
        </div>
      </template>
    </UModal>

    <!-- Modal confirmation suppression marker -->
    <UModal
      :open="deleteMarkerConfirmOpen"
      :title="$t('common.confirm_delete')"
      @update:open="(v: boolean) => !v && (deleteMarkerConfirmOpen = false)"
    >
      <template #body>
        <p>{{ $t('gestion.map.marker_delete_confirm') }}</p>
      </template>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            :label="$t('common.cancel')"
            @click="deleteMarkerConfirmOpen = false"
          />
          <UButton
            color="error"
            :label="$t('common.delete')"
            :loading="deletingMarker"
            @click="confirmDeleteMarker"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import MarkerModal from '~/components/edition/zones/MarkerModal.vue'
import ZoneModal from '~/components/edition/zones/ZoneModal.vue'
import ZonesLegend from '~/components/edition/zones/ZonesLegend.vue'
import type { EditionMarker } from '~/composables/useEditionMarkers'
import type { EditionZone } from '~/composables/useEditionZones'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

definePageMeta({
  middleware: ['authenticated'],
})

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))

// État de chargement initial (ne change pas pendant les opérations CRUD)
const initialLoading = ref(true)

// Permissions
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

// Map public toggle
const { t } = useI18n()
const mapPublic = ref(false)

// Synchroniser mapPublic avec l'édition
watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      mapPublic.value = newEdition.mapPublic ?? false
    }
  },
  { immediate: true }
)

const { execute: updateMapPublic, loading: updatingMapPublic } = useApiAction(
  () => `/api/editions/${editionId.value}/map-public`,
  {
    method: 'PATCH',
    body: () => ({ mapPublic: mapPublic.value }),
    successMessage: { title: t('gestion.map.map_public_updated') },
    errorMessages: { default: t('gestion.map.map_public_error') },
    onSuccess: () => {
      // Mettre à jour le store local
      if (edition.value) {
        editionStore.setEdition({ ...edition.value, mapPublic: mapPublic.value })
      }
    },
    onError: () => {
      // Restaurer la valeur précédente en cas d'erreur
      mapPublic.value = edition.value?.mapPublic ?? false
    },
  }
)

const handleMapPublicChange = () => {
  updateMapPublic()
}

// Zones
const { zones, creating, updating, deleting, createZone, updateZone, deleteZone } =
  useEditionZones(editionId)

// Markers
const {
  markers,
  creating: creatingMarker,
  updating: updatingMarker,
  deleting: deletingMarker,
  createMarker,
  updateMarker,
  deleteMarker,
  updateMarkerPosition,
} = useEditionMarkers(editionId)

// Map
const mapContainerRef = ref<HTMLElement | null>(null)
const pendingCoordinates = ref<[number, number][] | null>(null)
const pendingMarkerPosition = ref<{ latitude: number; longitude: number } | null>(null)

const {
  map,
  isDrawing,
  isPlacingMarker,
  addZones,
  updatePolygonStyle,
  updatePolygonPopup,
  removePolygon,
  startDrawing,
  stopDrawing,
  setView,
  focusOnZone,
  addMarkers,
  updateMarkerPopup,
  updateMarkerIcon,
  removeMarker,
  startPlacingMarker,
  stopPlacingMarker,
  focusOnMarker,
} = useLeafletEditable(mapContainerRef, {
  center: computed(() => {
    if (edition.value?.latitude && edition.value?.longitude) {
      return [edition.value.latitude, edition.value.longitude]
    }
    return [46.603354, 1.888334]
  }).value,
  zoom: edition.value?.latitude ? 15 : 6,
  editable: true,
  onPolygonCreated: (coordinates) => {
    pendingCoordinates.value = coordinates
    openModal()
  },
  onPolygonEdited: async (zoneId, coordinates) => {
    const zone = zones.value.find((z) => z.id === zoneId)
    if (zone) {
      await updateZone(zoneId, { coordinates })
    }
  },
  onMarkerCreated: (latitude, longitude) => {
    pendingMarkerPosition.value = { latitude, longitude }
    openMarkerModal()
  },
  onMarkerMoved: async (markerId, latitude, longitude) => {
    await updateMarkerPosition(markerId, latitude, longitude)
  },
})

// Ajouter les zones à la carte quand elles sont chargées ET que la carte est prête
// Note: addZones vérifie déjà les doublons via polygons.value.has(zone.id)
// deep: true nécessaire car [zones, map] fait une comparaison superficielle de .value
// et push() ne change pas la référence du tableau
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
  { immediate: true, deep: true }
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
  { immediate: true, deep: true }
)

// Flag pour ne centrer la carte qu'une seule fois
const initialViewSet = ref(false)

// Charger l'édition si nécessaire
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId.value, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
  initialLoading.value = false
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

// Modal Zone
const modalOpen = ref(false)
const editingZone = ref<EditionZone | null>(null)

const openModal = (zone?: EditionZone) => {
  editingZone.value = zone || null
  modalOpen.value = true
}

const closeModal = () => {
  modalOpen.value = false
  editingZone.value = null
  pendingCoordinates.value = null
  stopDrawing()
}

// Modal Marker
const markerModalOpen = ref(false)
const editingMarker = ref<EditionMarker | null>(null)

const openMarkerModal = (marker?: EditionMarker) => {
  editingMarker.value = marker || null
  markerModalOpen.value = true
}

const closeMarkerModal = () => {
  markerModalOpen.value = false
  editingMarker.value = null
  pendingMarkerPosition.value = null
  stopPlacingMarker()
}

// Actions
const startDrawingNewZone = () => {
  startDrawing('#3b82f6')
}

const cancelDrawing = () => {
  stopDrawing()
  pendingCoordinates.value = null
}

const handleEditZone = (zone: EditionZone) => {
  openModal(zone)
}

const zoneToDelete = ref<EditionZone | null>(null)
const deleteConfirmOpen = ref(false)

const handleDeleteZone = (zone: EditionZone) => {
  zoneToDelete.value = zone
  deleteConfirmOpen.value = true
}

const confirmDelete = async () => {
  if (!zoneToDelete.value) return

  const zoneId = zoneToDelete.value.id
  const success = await deleteZone(zoneId)

  if (success) {
    removePolygon(zoneId)
  }

  deleteConfirmOpen.value = false
  zoneToDelete.value = null
}

const handleFocusZone = (zone: EditionZone) => {
  focusOnZone(zone.id)
}

// Marker actions
const startPlacingNewMarker = () => {
  startPlacingMarker()
}

const cancelPlacingMarker = () => {
  stopPlacingMarker()
  pendingMarkerPosition.value = null
}

const handleEditMarker = (marker: EditionMarker) => {
  openMarkerModal(marker)
}

const markerToDelete = ref<EditionMarker | null>(null)
const deleteMarkerConfirmOpen = ref(false)

const handleDeleteMarker = (marker: EditionMarker) => {
  markerToDelete.value = marker
  deleteMarkerConfirmOpen.value = true
}

const confirmDeleteMarker = async () => {
  if (!markerToDelete.value) return

  const markerId = markerToDelete.value.id
  const success = await deleteMarker(markerId)

  if (success) {
    removeMarker(markerId)
  }

  deleteMarkerConfirmOpen.value = false
  markerToDelete.value = null
}

const handleFocusMarker = (marker: EditionMarker) => {
  focusOnMarker(marker.id)
}

const handleSaveMarker = async (data: {
  name: string
  description: string | null
  markerType: string
  color: string
}) => {
  if (editingMarker.value) {
    // Mise à jour
    const success = await updateMarker(editingMarker.value.id, data)
    if (success) {
      updateMarkerPopup(editingMarker.value.id, data.name, data.description)
      updateMarkerIcon(editingMarker.value.id, data.markerType, data.color)
    }
  } else if (pendingMarkerPosition.value) {
    // Création - le marker sera ajouté automatiquement via le watch sur markers
    await createMarker({
      ...data,
      latitude: pendingMarkerPosition.value.latitude,
      longitude: pendingMarkerPosition.value.longitude,
    })
  }

  closeMarkerModal()
}

const handleSaveZone = async (data: {
  name: string
  description: string | null
  color: string
  zoneType: string
}) => {
  if (editingZone.value) {
    // Mise à jour
    const success = await updateZone(editingZone.value.id, data)
    if (success) {
      updatePolygonStyle(editingZone.value.id, data.color)
      updatePolygonPopup(editingZone.value.id, data.name, data.description)
    }
  } else if (pendingCoordinates.value) {
    // Création - la zone sera ajoutée automatiquement via le watch sur zones
    await createZone({
      ...data,
      coordinates: pendingCoordinates.value,
    })
  }

  closeModal()
}
</script>

<style scoped>
/* Fix pour s'assurer que les tuiles Leaflet restent visibles */
:deep(.leaflet-container) {
  background-color: #f2f2f2 !important;
}

:deep(.leaflet-tile-pane) {
  opacity: 1 !important;
  visibility: visible !important;
}

:deep(.leaflet-tile-container) {
  visibility: visible !important;
  opacity: 1 !important;
}

:deep(.leaflet-tile) {
  visibility: visible !important;
  opacity: 1 !important;
}

:deep(.leaflet-layer) {
  visibility: visible !important;
  opacity: 1 !important;
}

/* S'assurer que le overlay pane n'a pas de fond opaque */
:deep(.leaflet-overlay-pane) {
  background: transparent !important;
}

/* S'assurer que l'editable layer ne cache pas les tuiles */
:deep(.leaflet-editable-feature-editor) {
  background: transparent !important;
}

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
