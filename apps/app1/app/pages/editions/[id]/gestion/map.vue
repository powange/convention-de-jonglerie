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
          <h1 class="text-2xl font-bold">{{ $t('edition.site_map') }}</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {{ $t('gestion.map.click_to_draw') }}
          </p>
        </div>

        <!-- Les outils de dessin ne sont plus ici mais sur la carte, à portée du geste qu'ils
             déclenchent. -->
        <USwitch
          v-model="mapPublic"
          :label="$t('gestion.map.map_public')"
          :loading="updatingMapPublic"
          @update:model-value="handleMapPublicChange"
        />
      </div>

      <!-- Carte externe : un organisateur ayant déjà cartographié son terrain sur Google My Maps
           colle son URL ici plutôt que de tout refaire. Elle remplace alors la carte interne.
           Repliée sur mobile : c'est une configuration qu'on renseigne une fois, et déployée
           elle prenait deux cent cinquante pixels sur la carte, qu'on regarde à chaque visite. -->
      <UCard :ui="configExterneVisible ? undefined : { body: 'pb-0' }">
        <!-- Sur mobile, un bouton remplace le formulaire tant qu'on ne le demande pas : déployé,
             il prenait deux cent cinquante pixels sur la carte, alors qu'on renseigne cette
             adresse une fois pour toutes. Au-delà de `lg`, rien ne change. -->
        <UButton
          class="lg:hidden group w-full justify-between p-0 mb-3 hover:bg-transparent"
          variant="ghost"
          color="neutral"
          :ui="{
            trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
          }"
          trailing-icon="i-heroicons-chevron-down"
          :data-state="configExterneDepliee ? 'open' : 'closed'"
          :label="$t('gestion.map.external_map_label')"
          @click="configExterneDepliee = !configExterneDepliee"
        />

        <div :class="configExterneDepliee ? '' : 'hidden lg:block'">
          <UFormField
            :label="$t('gestion.map.external_map_label')"
            :description="$t('gestion.map.external_map_help')"
          >
            <div class="flex flex-col gap-2 sm:flex-row">
              <UInput
                v-model="externalMapUrl"
                :placeholder="$t('gestion.map.external_map_placeholder')"
                class="flex-1"
              />
              <UButton :loading="savingExternalMap" @click="saveExternalMap">
                {{ $t('common.save') }}
              </UButton>
            </div>
          </UFormField>

          <UAlert
            v-if="edition?.externalMapRef"
            icon="i-heroicons-information-circle"
            color="info"
            variant="subtle"
            :description="$t('gestion.map.external_map_active')"
            class="mt-3"
          />

          <!-- L'import reprend les objets de la carte externe pour en faire des zones du site :
             il n'a de sens qu'une fois une carte renseignée. -->
          <div
            v-if="edition?.externalMapRef"
            class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ $t('gestion.map.import_open_help') }}
            </p>
            <UButton
              icon="i-lucide-download"
              color="neutral"
              variant="outline"
              :to="`/editions/${editionId}/gestion/map-import`"
              :label="$t('gestion.map.import_open')"
            />
          </div>
        </div>
      </UCard>

      <!-- Contenu principal -->
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- Carte. En mobile elle sort du cadre, comme sur la carte publique : les marges
             négatives annulent le rembourrage latéral du gabarit et la carte perd bordure et
             coins arrondis. Dessiner une zone sur un carré de 390 px tenait de l'exploit. -->
        <div :ref="(el) => enregistrerSection(el)" class="lg:col-span-2 relative z-0">
          <UCard
            class="w-auto -mx-4 sm:-mx-6 rounded-none ring-0 h-(--carte-hauteur) lg:mx-0 lg:w-full lg:rounded-lg lg:ring-1 lg:h-[calc(100vh-var(--ui-header-height)-10rem)]"
            :style="{ '--carte-hauteur': carteHauteur }"
            :ui="{ body: 'h-full p-0' }"
          >
            <div class="relative h-full w-full">
              <div
                ref="mapContainerRef"
                class="h-full w-full rounded-none lg:rounded-lg cursor-crosshair"
              />

              <!-- Outils de dessin, posés sur la carte plutôt qu'au-dessus d'elle : ils agissent
                   sur elle, et l'en-tête coûtait deux boutons pleine largeur avant de la voir.
                   En haut à gauche, sous le zoom : le bas de la carte est recouvert par le panneau
                   dès qu'on est en dessous de `lg`, et le coin haut droit porte le sélecteur de
                   couches. Voisins des contrôles Leaflet, ils doivent en partager le plan.

                   Le décalage vertical est mesuré, non deviné : le zoom de Leaflet s'arrête à
                   74 px du haut de la carte — 10 de marge et deux boutons de 30 — et un premier
                   essai à 4,5 rem le chevauchait de deux pixels.

                   Frères du conteneur et non enfants : Leaflet dispose librement des siens. -->
              <div class="absolute left-2 top-24 z-[1000] flex flex-col gap-2">
                <!-- Tous en neutre, et à fond plein. Neutre parce que rien, sur une carte, ne
                     doit attirer l'œil plus que ce qu'on y a dessiné : la couleur d'accent, portée
                     par le bouton de dessin jusqu'ici, se disputait la vue avec les zones. Plein
                     parce qu'un fond transparent laisse passer routes et bâtiments sous l'icône. -->
                <template v-if="!isDrawing && !isPlacingMarker">
                  <UTooltip :text="$t('gestion.map.draw_polygon')">
                    <UButton
                      icon="i-lucide-pentagon"
                      color="neutral"
                      size="xl"
                      :aria-label="$t('gestion.map.draw_polygon')"
                      @click="startDrawingNewZone"
                    />
                  </UTooltip>

                  <UTooltip :text="$t('gestion.map.place_marker')">
                    <UButton
                      icon="i-lucide-map-pin"
                      color="neutral"
                      size="xl"
                      :aria-label="$t('gestion.map.place_marker')"
                      @click="startPlacingNewMarker"
                    />
                  </UTooltip>
                </template>

                <UTooltip v-else :text="etiquetteAnnulation">
                  <UButton
                    icon="i-lucide-x"
                    color="neutral"
                    size="xl"
                    :aria-label="etiquetteAnnulation"
                    @click="isDrawing ? cancelDrawing() : cancelPlacingMarker()"
                  />
                </UTooltip>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Légende. En dessous de `lg` elle vit dans le tiroir : la laisser aussi dans le flux
             la ferait exister en double, avec deux états de visibilité divergents. -->
        <div class="hidden lg:block">
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-layers" class="h-5 w-5" />
                <h2 class="font-semibold">{{ $t('map.zones_list') }}</h2>
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
              @toggle-visibility="handleToggleVisibility"
            />
          </UCard>
        </div>
      </div>

      <!-- Panneau du bas, en mobile uniquement. Ni voile ni mode modal : on doit pouvoir dessiner
           et déplacer la carte pendant qu'il reste ouvert. Non refermable non plus — le cran le
           plus bas fait office de poignée. -->
      <UDrawer
        v-if="estMobile"
        v-model:open="panneauOuvert"
        :snap-points="CRANS_PANNEAU"
        :active-snap-point="cranImpose"
        :modal="false"
        :overlay="false"
        :dismissible="false"
        :ui="UI_PANNEAU"
        @drag="rendreLaMain"
      >
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-layers" class="h-5 w-5" />
            <h2 class="font-semibold">{{ $t('map.zones_list') }}</h2>
            <UBadge color="neutral" variant="subtle" size="sm">
              {{ zones.length + markers.length }}
            </UBadge>
          </div>
        </template>

        <template #body>
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
            @toggle-visibility="handleToggleVisibility"
          />
        </template>
      </UDrawer>
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
      :zones="zones"
      :loading="creatingMarker || updatingMarker"
      @close="closeMarkerModal"
      @save="handleSaveMarker"
    />

    <!-- Modal confirmation suppression zone -->
    <!-- Même règle d'empilement que les deux modales ci-dessus : voir ZoneModal. -->
    <UModal
      :open="deleteConfirmOpen"
      :ui="{ overlay: 'z-50', content: 'z-50' }"
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
    <!-- Même règle d'empilement que les deux modales ci-dessus : voir ZoneModal. -->
    <UModal
      :open="deleteMarkerConfirmOpen"
      :ui="{ overlay: 'z-50', content: 'z-50' }"
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
import {
  buildMarkerAttachmentHtml,
  buildZoneAttachmentHtml,
  groupMarkersByZone,
  zoneNavigationTarget,
} from '~/utils/map-zone-attachment'

import type { ExternalMapProvider } from '~~/shared/utils/external-map'

import { externalMapViewerUrl } from '~~/shared/utils/external-map'

definePageMeta({
  middleware: ['auth-protected'],
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

// Carte externe. Le champ affiche l'URL du visualiseur reconstruite depuis la référence stockée,
// pour que l'organisateur retrouve quelque chose qu'il reconnaît plutôt qu'un identifiant nu.
const externalMapUrl = ref('')
const savingExternalMap = ref(false)

const viewerUrlFor = (provider?: string | null, mapRef?: string | null) =>
  provider && mapRef
    ? (externalMapViewerUrl({ provider: provider as ExternalMapProvider, ref: mapRef }) ?? '')
    : ''

// Synchroniser mapPublic avec l'édition
watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      mapPublic.value = newEdition.mapPublic ?? false
      externalMapUrl.value = viewerUrlFor(newEdition.externalMapProvider, newEdition.externalMapRef)
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

// Le serveur ne conserve que le fournisseur et la référence de la carte : c'est lui qui valide
// l'URL et refuse ce qu'il ne reconnaît pas, plutôt que d'effacer silencieusement le réglage.
const { execute: updateExternalMap } = useApiAction(
  () => `/api/editions/${editionId.value}/external-map`,
  {
    method: 'PATCH',
    body: () => ({ url: externalMapUrl.value }),
    successMessage: { title: t('gestion.map.external_map_saved') },
    errorMessages: { default: t('gestion.map.external_map_error') },
    onSuccess: (data: any) => {
      const provider = data?.externalMapProvider ?? null
      const mapRef = data?.externalMapRef ?? null
      if (edition.value) {
        editionStore.setEdition({
          ...edition.value,
          externalMapProvider: provider,
          externalMapRef: mapRef,
        })
      }
      externalMapUrl.value = viewerUrlFor(provider, mapRef)
    },
  }
)

const saveExternalMap = async () => {
  savingExternalMap.value = true
  try {
    await updateExternalMap()
  } finally {
    savingExternalMap.value = false
  }
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
  fetchMarkers,
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
  updateZoneIcon,
  removePolygon,
  startDrawing,
  stopDrawing,
  focusOnZone,
  addMarkers,
  updateMarkerPopup,
  updateMarkerIcon,
  removeMarker,
  startPlacingMarker,
  stopPlacingMarker,
  focusOnMarker,
  showZone,
  hideZone,
  showMarker,
  hideMarker,
  fitBoundsToItems,
  setPopupExtra,
  setZoneNavigationTarget,
} = useLeafletEditable(mapContainerRef, {
  // Un couple, pas un tableau de nombres : Leaflet distingue les deux.
  center: computed<[number, number]>(() => {
    if (edition.value?.latitude && edition.value?.longitude) {
      return [edition.value.latitude, edition.value.longitude]
    }
    return [46.603354, 1.888334]
  }).value,
  zoom: edition.value?.latitude ? 15 : 6,
  editable: true,
  typeLabel: (type: string) => t(`map.types.${type.toLowerCase()}`),
  popupLabels: {
    navigate: t('map.popup_navigate'),
    edit: t('gestion.map.popup_edit'),
    delete: t('gestion.map.popup_delete'),
  },
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
  onEditRequest: (type, id) => {
    if (type === 'zone') {
      const zone = zones.value.find((z) => z.id === id)
      if (zone) handleEditZone(zone)
    } else {
      const marker = markers.value.find((m) => m.id === id)
      if (marker) handleEditMarker(marker)
    }
  },
  onDeleteRequest: (type, id) => {
    if (type === 'zone') {
      const zone = zones.value.find((z) => z.id === id)
      if (zone) handleDeleteZone(zone)
    } else {
      const marker = markers.value.find((m) => m.id === id)
      if (marker) handleDeleteMarker(marker)
    }
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
          zoneTypes: z.zoneTypes,
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
          markerTypes: m.markerTypes,
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

// Adapter le zoom pour afficher tous les éléments (une seule fois)
// nextTick garantit que les watches addZones/addMarkers ont peuplé les structures Leaflet
watch(
  [zones, markers, map],
  async ([newZones, newMarkers, newMap]) => {
    if (!initialViewSet.value && newMap && (newZones.length > 0 || newMarkers.length > 0)) {
      await nextTick()
      fitBoundsToItems()
      initialViewSet.value = true
    }
  },
  { immediate: true, deep: true }
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
// Rattachement zone/entrée : les popups se citent mutuellement et l'itinéraire d'une zone vise
// son entrée. Le modèle garde deux éléments, l'affichage n'en montre qu'un.
watch(
  [zones, markers, map],
  () => {
    if (!map.value) return

    const attachedByZone = groupMarkersByZone(markers.value)
    const zoneNameById = new Map(zones.value.map((zone) => [zone.id, zone.name]))

    for (const zone of zones.value) {
      const attached = attachedByZone.get(zone.id)
      setPopupExtra('zone', zone.id, buildZoneAttachmentHtml(attached, t('map.zone_entrances')))
      setZoneNavigationTarget(zone.id, zoneNavigationTarget(attached))
    }

    for (const marker of markers.value) {
      setPopupExtra(
        'marker',
        marker.id,
        marker.zoneId
          ? buildMarkerAttachmentHtml(zoneNameById.get(marker.zoneId), t('map.marker_entrance_of'))
          : ''
      )
    }
  },
  { immediate: true }
)

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

/**
 * Un seul bouton d'annulation sert les deux modes — ils s'excluent —, mais il doit dire lequel il
 * interrompt : réduit à une icône, il n'a plus que son infobulle et son étiquette d'accessibilité
 * pour le faire.
 */
const etiquetteAnnulation = computed(() =>
  isDrawing.value ? t('gestion.map.stop_drawing') : t('gestion.map.stop_placing')
)

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
    // La base a détaché les entrées de cette zone (`SetNull`) ; sans relecture, la liste locale
    // garderait un rattachement mort et le renvoyer au serveur ferait échouer la moindre
    // modification du marqueur.
    await fetchMarkers()
  }

  deleteConfirmOpen.value = false
  zoneToDelete.value = null
}

/**
 * Carte plein écran et panneau du bas sur mobile — même mécanisme que la carte publique, dont
 * cette page reprend la mise en page.
 */
const {
  estMobile,
  enregistrerSection,
  carteHauteur,
  CRANS_PANNEAU,
  UI_PANNEAU,
  panneauOuvert,
  cranImpose,
  rendreLaMain,
  replierPanneau,
} = useCartePleinEcranMobile(map)

/** Repliée par défaut sur mobile ; toujours ouverte au-delà de `lg`, où la place ne manque pas. */
const configExterneDepliee = ref(false)
const configExterneVisible = computed(() => configExterneDepliee.value || !estMobile.value)

const handleFocusZone = (zone: EditionZone) => {
  focusOnZone(zone.id)
  replierPanneau()
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
  replierPanneau()
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

const handleSaveMarker = async (data: {
  name: string
  description: string | null
  markerTypes: string[]
  color: string
  zoneId: number | null
}) => {
  if (editingMarker.value) {
    // Mise à jour
    const success = await updateMarker(editingMarker.value.id, data)
    if (success) {
      updateMarkerPopup(editingMarker.value.id, data.name, data.description)
      updateMarkerIcon(editingMarker.value.id, data.markerTypes, data.color)
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
  zoneTypes: string[]
}) => {
  if (editingZone.value) {
    // Mise à jour
    const success = await updateZone(editingZone.value.id, data)
    if (success) {
      updatePolygonStyle(editingZone.value.id, data.color)
      updatePolygonPopup(editingZone.value.id, data.name, data.description)
      updateZoneIcon(editingZone.value.id, data.zoneTypes, data.color)
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
</style>
