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
          Gérer l'activation des workshops et les lieux disponibles
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
              <div class="flex items-center gap-2">
                <UButton
                  v-if="canEdit && workshopsEnabledLocal"
                  size="sm"
                  color="primary"
                  variant="soft"
                  icon="i-heroicons-photo"
                  @click="openImportWorkshopsModal"
                >
                  {{ $t('workshops.import_from_image') }}
                </UButton>
                <UBadge :color="workshopsEnabledLocal ? 'success' : 'neutral'" variant="soft">
                  {{
                    workshopsEnabledLocal
                      ? $t('common.active') || 'Actif'
                      : $t('common.inactive') || 'Inactif'
                  }}
                </UBadge>
              </div>
            </div>

            <div
              v-if="canEdit"
              class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
            >
              <div>
                <h3 class="font-medium text-gray-900 dark:text-white">
                  {{ $t('gestion.workshops.enable_workshops') }}
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  Permettre aux participants et bénévoles de créer des workshops
                </p>
              </div>
              <USwitch
                v-model="workshopsEnabledLocal"
                :disabled="savingWorkshops"
                color="primary"
                @update:model-value="handleToggleWorkshops"
              />
            </div>

            <div v-if="workshopsEnabledLocal">
              <UAlert
                :title="$t('gestion.workshops.workshops_enabled_notice')"
                :description="$t('gestion.workshops.workshops_enabled_description')"
                icon="i-heroicons-academic-cap"
                color="success"
                variant="subtle"
              />

              <!-- Gestion des lieux -->
              <div class="mt-6 space-y-3">
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
                      :loading="deletingLocationId === location.id"
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
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Gestion de l'activation des workshops
const workshopsEnabledLocal = ref(false)
const savingWorkshops = ref(false)

// Initialiser workshopsEnabled depuis l'édition
watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      workshopsEnabledLocal.value = newEdition.workshopsEnabled || false
    }
  },
  { immediate: true }
)

const handleToggleWorkshops = async (val: boolean) => {
  const previous = !val
  savingWorkshops.value = true

  try {
    await $fetch(`/api/editions/${editionId}`, {
      method: 'PUT',
      body: { workshopsEnabled: val },
    })

    // Recharger l'édition
    await editionStore.fetchEditionById(editionId, { force: true })

    toast.add({
      title: t('common.saved') || 'Sauvegardé',
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })

    // Charger les lieux si workshops activés
    if (val) {
      await fetchWorkshopLocations()
    }
  } catch (e: any) {
    workshopsEnabledLocal.value = previous
    toast.add({
      title: e?.data?.message || e?.message || t('common.error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    savingWorkshops.value = false
  }
}

// Gestion des lieux de workshops
const workshopLocations = ref<any[]>([])
const newLocationName = ref('')
const addingLocation = ref(false)
const deletingLocationId = ref<number | null>(null)
const workshopLocationsFreeInputLocal = ref(false)
const savingLocationMode = ref(false)

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

const fetchWorkshopLocations = async () => {
  try {
    const data = await $fetch(`/api/editions/${editionId}/workshops/locations`)
    workshopLocations.value = data as any[]
  } catch (error) {
    console.error('Failed to fetch workshop locations:', error)
  }
}

const addLocation = async () => {
  if (!newLocationName.value.trim()) return

  addingLocation.value = true
  try {
    await $fetch(`/api/editions/${editionId}/workshops/locations`, {
      method: 'POST',
      body: { name: newLocationName.value.trim() },
    })

    toast.add({
      title: t('workshops.location_added'),
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })

    newLocationName.value = ''
    await fetchWorkshopLocations()
  } catch (error: any) {
    toast.add({
      title: error?.data?.message || t('workshops.location_error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    addingLocation.value = false
  }
}

const deleteLocation = async (locationId: number) => {
  if (!confirm(t('workshops.confirm_delete_location'))) {
    return
  }

  deletingLocationId.value = locationId
  try {
    await $fetch(`/api/editions/${editionId}/workshops/locations/${locationId}`, {
      method: 'DELETE',
    })

    toast.add({
      title: t('workshops.location_deleted'),
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })

    await fetchWorkshopLocations()
  } catch (error: any) {
    toast.add({
      title: error?.data?.message || t('workshops.location_error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    deletingLocationId.value = null
  }
}

const handleToggleLocationMode = async (val: boolean) => {
  const previous = !val
  savingLocationMode.value = true

  try {
    await $fetch(`/api/editions/${editionId}`, {
      method: 'PUT',
      body: { workshopLocationsFreeInput: val },
    })

    // Recharger l'édition
    await editionStore.fetchEditionById(editionId, { force: true })

    toast.add({
      title: t('common.saved') || 'Sauvegardé',
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
  } catch (e: any) {
    workshopLocationsFreeInputLocal.value = previous
    toast.add({
      title: e?.data?.message || e?.message || t('common.error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  } finally {
    savingLocationMode.value = false
  }
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
