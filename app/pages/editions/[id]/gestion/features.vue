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
          <UIcon name="i-lucide-toggle-right" class="text-blue-600 dark:text-blue-400" />
          {{ $t('gestion.features.title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('gestion.features.description') }}
        </p>
      </div>

      <!-- Liste des fonctionnalités -->
      <div class="space-y-4">
        <!-- Bénévoles -->
        <UCard>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-user-group" class="text-primary-500 size-5" />
              <div>
                <h3 class="font-medium text-gray-900 dark:text-white">
                  {{ $t('edition.ticketing.volunteer_management') }}
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.features.volunteers_description') }}
                </p>
              </div>
            </div>
            <USwitch
              v-model="volunteersEnabledLocal"
              :loading="savingVolunteers"
              :disabled="savingVolunteers"
              color="primary"
              @update:model-value="handleToggleVolunteers"
            />
          </div>
        </UCard>

        <!-- Repas -->
        <UCard>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UIcon name="cbi:mealie" class="text-orange-500 size-5" />
              <div>
                <h3 class="font-medium text-gray-900 dark:text-white">
                  {{ $t('gestion.meals.title') }}
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.features.meals_description') }}
                </p>
              </div>
            </div>
            <USwitch
              v-model="mealsEnabledLocal"
              :loading="savingMeals"
              :disabled="savingMeals"
              color="primary"
              @update:model-value="handleToggleMeals"
            />
          </div>
        </UCard>

        <!-- Artistes -->
        <UCard>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-star" class="text-yellow-500 size-5" />
              <div>
                <h3 class="font-medium text-gray-900 dark:text-white">
                  {{ $t('gestion.artists.title') }}
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.features.artists_description') }}
                </p>
              </div>
            </div>
            <USwitch
              v-model="artistsEnabledLocal"
              :loading="savingArtists"
              :disabled="savingArtists"
              color="primary"
              @update:model-value="handleToggleArtists"
            />
          </div>
        </UCard>

        <!-- Billetterie -->
        <UCard>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-ticket" class="text-blue-500 size-5" />
              <div>
                <h3 class="font-medium text-gray-900 dark:text-white">
                  {{ $t('gestion.ticketing.title') }}
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.features.ticketing_description') }}
                </p>
              </div>
            </div>
            <USwitch
              v-model="ticketingEnabledLocal"
              :loading="savingTicketing"
              :disabled="savingTicketing"
              color="primary"
              @update:model-value="handleToggleTicketing"
            />
          </div>
        </UCard>

        <!-- Workshops -->
        <UCard>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-academic-cap" class="text-green-500 size-5" />
              <div>
                <h3 class="font-medium text-gray-900 dark:text-white">
                  {{ $t('gestion.workshops.title') }}
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.features.workshops_description') }}
                </p>
              </div>
            </div>
            <USwitch
              v-model="workshopsEnabledLocal"
              :loading="savingWorkshops"
              :disabled="savingWorkshops"
              color="primary"
              @update:model-value="handleToggleWorkshops"
            />
          </div>
        </UCard>
        <!-- Carte du site -->
        <UCard>
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <UIcon name="i-lucide-map" class="text-blue-500 size-5" />
              <div>
                <h3 class="font-medium text-gray-900 dark:text-white">
                  {{ $t('gestion.map.title') }}
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('gestion.features.site_map_description') }}
                </p>
              </div>
            </div>
            <USwitch
              v-model="siteMapEnabledLocal"
              :loading="savingSiteMap"
              :disabled="savingSiteMap"
              color="primary"
              @update:model-value="handleToggleSiteMap"
            />
          </div>
        </UCard>
      </div>
    </div>
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

// Gestion de l'activation des bénévoles
const volunteersEnabledLocal = ref(false)

// Gestion de l'activation des repas
const mealsEnabledLocal = ref(false)

// Gestion de l'activation des artistes
const artistsEnabledLocal = ref(false)

// Gestion de l'activation de la billetterie
const ticketingEnabledLocal = ref(false)

// Gestion de l'activation des workshops
const workshopsEnabledLocal = ref(false)

// Gestion de l'activation de la carte du site
const siteMapEnabledLocal = ref(false)

watch(
  edition,
  (newEdition) => {
    if (newEdition) {
      volunteersEnabledLocal.value = newEdition.volunteersEnabled || false
      mealsEnabledLocal.value = newEdition.mealsEnabled || false
      artistsEnabledLocal.value = newEdition.artistsEnabled || false
      ticketingEnabledLocal.value = newEdition.ticketingEnabled || false
      workshopsEnabledLocal.value = newEdition.workshopsEnabled || false
      siteMapEnabledLocal.value = newEdition.siteMapEnabled || false
    }
  },
  { immediate: true }
)

const { execute: executeToggleVolunteers, loading: savingVolunteers } = useApiAction(
  `/api/editions/${editionId}`,
  {
    method: 'PUT',
    body: () => ({ volunteersEnabled: volunteersEnabledLocal.value }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: async () => {
      await editionStore.fetchEditionById(editionId, { force: true })
    },
    onError: () => {
      volunteersEnabledLocal.value = !volunteersEnabledLocal.value
    },
  }
)

const handleToggleVolunteers = () => {
  executeToggleVolunteers()
}

const { execute: executeToggleMeals, loading: savingMeals } = useApiAction(
  `/api/editions/${editionId}`,
  {
    method: 'PUT',
    body: () => ({ mealsEnabled: mealsEnabledLocal.value }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: async () => {
      await editionStore.fetchEditionById(editionId, { force: true })
    },
    onError: () => {
      mealsEnabledLocal.value = !mealsEnabledLocal.value
    },
  }
)

const handleToggleMeals = () => {
  executeToggleMeals()
}

const { execute: executeToggleArtists, loading: savingArtists } = useApiAction(
  `/api/editions/${editionId}`,
  {
    method: 'PUT',
    body: () => ({ artistsEnabled: artistsEnabledLocal.value }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: async () => {
      await editionStore.fetchEditionById(editionId, { force: true })
    },
    onError: () => {
      artistsEnabledLocal.value = !artistsEnabledLocal.value
    },
  }
)

const handleToggleArtists = () => {
  executeToggleArtists()
}

const { execute: executeToggleTicketing, loading: savingTicketing } = useApiAction(
  `/api/editions/${editionId}`,
  {
    method: 'PUT',
    body: () => ({ ticketingEnabled: ticketingEnabledLocal.value }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: async () => {
      await editionStore.fetchEditionById(editionId, { force: true })
    },
    onError: () => {
      ticketingEnabledLocal.value = !ticketingEnabledLocal.value
    },
  }
)

const handleToggleTicketing = () => {
  executeToggleTicketing()
}

const { execute: executeToggleWorkshops, loading: savingWorkshops } = useApiAction(
  `/api/editions/${editionId}`,
  {
    method: 'PUT',
    body: () => ({ workshopsEnabled: workshopsEnabledLocal.value }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: async () => {
      await editionStore.fetchEditionById(editionId, { force: true })
    },
    onError: () => {
      workshopsEnabledLocal.value = !workshopsEnabledLocal.value
    },
  }
)

const handleToggleWorkshops = () => {
  executeToggleWorkshops()
}

const { execute: executeToggleSiteMap, loading: savingSiteMap } = useApiAction(
  `/api/editions/${editionId}`,
  {
    method: 'PUT',
    body: () => ({ siteMapEnabled: siteMapEnabledLocal.value }),
    successMessage: { title: t('common.saved') },
    errorMessages: { default: t('common.error') },
    onSuccess: async () => {
      await editionStore.fetchEditionById(editionId, { force: true })
    },
    onError: () => {
      siteMapEnabledLocal.value = !siteMapEnabledLocal.value
    },
  }
)

const handleToggleSiteMap = () => {
  executeToggleSiteMap()
}

// Vérifier l'accès à cette page
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return canEdit.value
})

const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

// Charger l'édition
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }
})

useSeoMeta({
  title: t('gestion.features.title'),
})
</script>
