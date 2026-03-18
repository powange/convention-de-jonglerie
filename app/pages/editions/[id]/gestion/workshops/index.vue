<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('edition.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('edition.not_found') }}</p>
    </div>
    <div v-else-if="!canAccess">
      <UAlert
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
        :title="$t('pages.access_denied.title')"
        :description="$t('pages.access_denied.description')"
      />
    </div>
    <div v-else>
      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-academic-cap" class="text-green-600 dark:text-green-400" />
          {{ $t('gestion.workshops.title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('workshops.locations_description') }}
        </p>
      </div>

      <!-- Contenu de la gestion des workshops -->
      <div class="space-y-6">
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-academic-cap" class="text-green-500" />
                <h2 class="text-lg font-semibold">{{ $t('gestion.workshops.title') }}</h2>
              </div>
              <UButton
                v-if="canEdit"
                size="sm"
                color="primary"
                variant="soft"
                icon="i-heroicons-photo"
                @click="openImportWorkshopsModal"
              >
                {{ $t('workshops.import_from_image') }}
              </UButton>
            </div>

            <!-- Gestion des lieux -->
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">
                    {{ $t('workshops.locations') }}
                  </h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('workshops.locations_description') }}
                  </p>
                </div>
              </div>

              <!-- Mode de saisie -->
              <div
                v-if="canEdit"
                class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
              >
                <div>
                  <h4 class="font-medium text-gray-900 dark:text-white">
                    {{ $t('workshops.location_mode') }}
                  </h4>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    {{
                      workshopLocationsFreeInputLocal
                        ? $t('workshops.location_mode_free_description')
                        : $t('workshops.location_mode_exclusive_description')
                    }}
                  </p>
                </div>
                <USwitch
                  v-model="workshopLocationsFreeInputLocal"
                  :disabled="savingLocationMode"
                  color="primary"
                  @update:model-value="handleToggleLocationMode"
                />
              </div>

              <!-- Liste des lieux -->
              <div v-if="workshopLocations.length > 0" class="space-y-2">
                <div
                  v-for="location in workshopLocations"
                  :key="location.id"
                  class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                >
                  <span class="text-sm text-gray-900 dark:text-white">{{ location.name }}</span>
                  <UButton
                    v-if="canEdit"
                    size="xs"
                    color="error"
                    variant="ghost"
                    icon="i-heroicons-trash"
                    :loading="isDeletingLocation(location.id)"
                    @click="deleteLocation(location.id)"
                  />
                </div>
              </div>

              <p v-else class="text-sm text-gray-500 dark:text-gray-400 italic">
                {{ $t('workshops.no_locations') }}
              </p>

              <!-- Formulaire d'ajout -->
              <div v-if="canEdit" class="flex gap-2">
                <UInput
                  v-model="newLocationName"
                  :placeholder="$t('workshops.location_name_placeholder')"
                  class="flex-1"
                  size="sm"
                  @keyup.enter="addLocation"
                />
                <UButton
                  size="sm"
                  icon="i-heroicons-plus"
                  :loading="addingLocation"
                  :disabled="!newLocationName.trim()"
                  @click="addLocation"
                >
                  {{ $t('workshops.add_location') }}
                </UButton>
              </div>

              <!-- Import depuis la carte du site -->
              <div
                v-if="canEdit && edition.siteMapEnabled && mapItems.length > 0"
                class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-3"
              >
                <div class="flex items-center gap-2">
                  <UIcon name="i-lucide-map" class="size-4 text-blue-600 dark:text-blue-400" />
                  <h4 class="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {{ $t('workshops.import_from_map') }}
                  </h4>
                </div>
                <p class="text-xs text-blue-700 dark:text-blue-300">
                  {{ $t('workshops.import_from_map_description') }}
                </p>
                <div class="flex flex-wrap gap-2">
                  <UButton
                    v-for="item in mapItems"
                    :key="item.key"
                    size="xs"
                    color="primary"
                    variant="soft"
                    :icon="item.type === 'zone' ? 'i-lucide-square' : 'i-lucide-map-pin'"
                    :disabled="isMapItemAlreadyAdded(item)"
                    :loading="addingFromMap"
                    @click="addLocationFromMap(item)"
                  >
                    {{ item.name }}
                    <UIcon v-if="isMapItemAlreadyAdded(item)" name="i-lucide-check" class="ml-1" />
                  </UButton>
                </div>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>

    <!-- Modal d'import de workshops depuis une image -->
    <WorkshopsImportFromImageModal
      v-model:open="importWorkshopsModalOpen"
      :edition-id="editionId"
      @success="handleWorkshopsImportSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Gestion des lieux de workshops
const workshopLocations = ref<any[]>([])
const newLocationName = ref('')
const workshopLocationsFreeInputLocal = ref(false)

// Initialiser workshopLocationsFreeInput depuis l'édition
watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      workshopLocationsFreeInputLocal.value =
        (newEdition as any).workshopLocationsFreeInput || false
    }
  },
  { immediate: true }
)

// Zones et markers de la carte du site
const mapZones = ref<Array<{ id: number; name: string }>>([])
const mapMarkers = ref<Array<{ id: number; name: string }>>([])

const mapItems = computed(() => {
  const items: Array<{ key: string; type: 'zone' | 'marker'; id: number; name: string }> = []
  mapZones.value.forEach((z) =>
    items.push({ key: `zone:${z.id}`, type: 'zone', id: z.id, name: z.name })
  )
  mapMarkers.value.forEach((m) =>
    items.push({ key: `marker:${m.id}`, type: 'marker', id: m.id, name: m.name })
  )
  return items
})

const isMapItemAlreadyAdded = (item: { type: 'zone' | 'marker'; id: number }) => {
  return workshopLocations.value.some(
    (loc) =>
      (item.type === 'zone' && loc.zoneId === item.id) ||
      (item.type === 'marker' && loc.markerId === item.id)
  )
}

const addingFromMap = ref(false)
const addLocationFromMap = async (item: { type: 'zone' | 'marker'; id: number; name: string }) => {
  addingFromMap.value = true
  try {
    const body: Record<string, unknown> = { name: item.name }
    if (item.type === 'zone') body.zoneId = item.id
    else body.markerId = item.id
    await $fetch(`/api/editions/${editionId}/workshops/locations`, {
      method: 'POST',
      body,
    })
    await fetchWorkshopLocations()
  } catch {
    // Erreur silencieuse
  } finally {
    addingFromMap.value = false
  }
}

const fetchWorkshopLocations = async () => {
  try {
    const promises: Promise<any>[] = [$fetch(`/api/editions/${editionId}/workshops/locations`)]
    if (edition.value?.siteMapEnabled) {
      promises.push($fetch(`/api/editions/${editionId}/zones`))
      promises.push($fetch(`/api/editions/${editionId}/markers`))
    }
    const [locResponse, zonesResponse, markersResponse] = await Promise.all(promises)
    workshopLocations.value = locResponse?.data?.locations || []
    if (edition.value?.siteMapEnabled) {
      mapZones.value = Array.isArray(zonesResponse?.data?.zones) ? zonesResponse.data.zones : []
      mapMarkers.value = Array.isArray(markersResponse?.data?.markers)
        ? markersResponse.data.markers
        : []
    }
  } catch (error) {
    console.error('Failed to fetch workshop locations:', error)
  }
}

const { execute: executeAddLocation, loading: addingLocation } = useApiAction(
  `/api/editions/${editionId}/workshops/locations`,
  {
    method: 'POST',
    body: () => ({ name: newLocationName.value.trim() }),
    successMessage: { title: t('workshops.location_added') },
    errorMessages: { default: t('workshops.location_error') },
    onSuccess: async () => {
      newLocationName.value = ''
      await fetchWorkshopLocations()
    },
  }
)

const addLocation = () => {
  if (!newLocationName.value.trim()) return
  executeAddLocation()
}

const { execute: executeDeleteLocation, isLoading: isDeletingLocation } = useApiActionById(
  (locationId) => `/api/editions/${editionId}/workshops/locations/${locationId}`,
  {
    method: 'DELETE',
    successMessage: { title: t('workshops.location_deleted') },
    errorMessages: { default: t('workshops.location_error') },
    onSuccess: async () => {
      await fetchWorkshopLocations()
    },
  }
)

const deleteLocation = (locationId: number) => {
  if (!confirm(t('workshops.confirm_delete_location'))) return
  executeDeleteLocation(locationId)
}

const { execute: executeToggleLocationMode, loading: savingLocationMode } = useApiAction(
  `/api/editions/${editionId}`,
  {
    method: 'PUT',
    body: () => ({ workshopLocationsFreeInput: workshopLocationsFreeInputLocal.value }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: async () => {
      await editionStore.fetchEditionById(editionId, { force: true })
    },
    onError: () => {
      workshopLocationsFreeInputLocal.value = !workshopLocationsFreeInputLocal.value
    },
  }
)

const handleToggleLocationMode = () => {
  executeToggleLocationMode()
}

// État pour la modal d'import de workshops
const importWorkshopsModalOpen = ref(false)

// Fonctions pour la modal d'import de workshops
const openImportWorkshopsModal = () => {
  importWorkshopsModalOpen.value = true
}

const handleWorkshopsImportSuccess = () => {
  // La modal se ferme automatiquement
  // On pourrait recharger les données si nécessaire
}

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return canEdit.value || authStore.user?.id === edition.value?.creatorId
})

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

// Charger l'édition et les données
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }

  // Charger les lieux si workshops activés
  if (edition.value?.workshopsEnabled) {
    await fetchWorkshopLocations()
  }
})

// Métadonnées de la page
useSeoMeta({
  title: 'Gestion des workshops - ' + (edition.value?.name || 'Édition'),
  description: "Gérer l'activation des workshops et les lieux disponibles",
  ogTitle: () => edition.value?.name || edition.value?.convention?.name || 'Convention',
})
</script>
