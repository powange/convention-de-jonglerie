<template>
  <div>
    <div v-if="loading">
      <p>{{ $t('common.loading') }}</p>
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
          <UIcon name="i-heroicons-cog-6-tooth" class="text-primary-600 dark:text-primary-400" />
          {{ $t('gestion.volunteers.config_title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('gestion.volunteers.config_page_description') }}
        </p>
      </div>

      <!-- Contenu de la page -->
      <div class="space-y-6">
        <!-- Paramètres généraux -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-cog-6-tooth" class="text-purple-500" />
              <h2 class="text-lg font-semibold">
                {{ $t('gestion.volunteers.general_settings') }}
              </h2>
            </div>

            <!-- Mode de gestion des bénévoles -->
            <div class="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">
                    {{ $t('gestion.volunteers.management_mode') }}
                  </h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('gestion.volunteers.management_mode_description') }}
                  </p>
                </div>
                <UBadge
                  :color="volunteersModeLocal === 'INTERNAL' ? 'primary' : 'warning'"
                  variant="soft"
                  size="sm"
                >
                  {{
                    volunteersModeLocal === 'INTERNAL'
                      ? $t('gestion.volunteers.mode_internal_badge')
                      : $t('gestion.volunteers.mode_external_badge')
                  }}
                </UBadge>
              </div>

              <UFormField>
                <URadioGroup
                  v-model="volunteersModeLocal"
                  :items="volunteerModeItems"
                  size="lg"
                  class="flex flex-row gap-6"
                  :disabled="!(canEdit || canManageVolunteers)"
                  @update:model-value="handleChangeMode"
                />
              </UFormField>

              <!-- Lien externe pour mode externe -->
              <div v-if="volunteersModeLocal === 'EXTERNAL'" class="pt-2">
                <UFormField
                  :label="$t('gestion.volunteers.external_link')"
                  :error="fieldErrors.externalUrl"
                >
                  <UInput
                    v-model="volunteersExternalUrlLocal"
                    :placeholder="$t('gestion.volunteers.external_url_placeholder')"
                    :disabled="!(canEdit || canManageVolunteers)"
                    class="w-full"
                    @blur="(canEdit || canManageVolunteers) && persistVolunteerSettings()"
                    @keydown.enter.prevent="
                      (canEdit || canManageVolunteers) && persistVolunteerSettings()
                    "
                  />
                </UFormField>
                <p class="text-xs text-gray-500 mt-1">
                  {{ $t('gestion.volunteers.external_url_description') }}
                </p>
              </div>
            </div>

            <!-- Ouverture des candidatures -->
            <div class="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">
                    {{ $t('gestion.volunteers.applications_open') }}
                  </h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('gestion.volunteers.applications_open_description') }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <UBadge :color="volunteersOpenLocal ? 'success' : 'neutral'" variant="soft">
                    {{
                      volunteersOpenLocal
                        ? $t('common.active') || 'Actif'
                        : $t('common.inactive') || 'Inactif'
                    }}
                  </UBadge>
                </div>
              </div>

              <div class="flex items-center gap-3">
                <USwitch
                  v-model="volunteersOpenLocal"
                  :disabled="savingVolunteers"
                  color="primary"
                  @update:model-value="handleToggleOpen"
                />
                <span
                  :class="
                    volunteersOpenLocal
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-600 dark:text-gray-400'
                  "
                >
                  {{
                    volunteersOpenLocal
                      ? $t('edition.volunteers.open')
                      : $t('edition.volunteers.closed_message')
                  }}
                </span>
              </div>
            </div>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useVolunteerSettings } from '~/composables/useVolunteerSettings'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

definePageMeta({
  middleware: ['authenticated'],
})

const route = useRoute()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const toast = useToast()
const { t } = useI18n()

const editionId = Number(route.params.id)

// Charger les données de l'édition
const { data: edition, pending: loading } = await useFetch(`/api/editions/${editionId}`, {
  key: `edition-${editionId}`,
})

// Utiliser le composable pour les paramètres des bénévoles
const {
  settings: volunteersSettings,
  updating: savingVolunteers,
  fieldErrors,
  fetchSettings: fetchVolunteersSettings,
  updateSettings,
} = useVolunteerSettings(editionId)

// Variables pour les paramètres généraux (mode et ouverture)
const volunteersOpenLocal = ref(false)
const volunteersModeLocal = ref<'INTERNAL' | 'EXTERNAL'>('INTERNAL')
const volunteersExternalUrlLocal = ref('')
const volunteersUpdatedAt = ref<Date | null>(null)
const volunteersInitialized = ref(false)

const volunteerModeItems = computed(() => [
  { value: 'INTERNAL', label: t('gestion.volunteers.mode_internal') || 'Interne' },
  { value: 'EXTERNAL', label: t('gestion.volunteers.mode_external') || 'Externe' },
])

// Permissions calculées
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

// Vérifier les permissions
const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return canEdit.value || canManageVolunteers.value
})

const applyVolunteerSettings = () => {
  if (volunteersSettings.value) {
    // Appliquer les paramètres généraux
    volunteersOpenLocal.value = !!volunteersSettings.value.open
    volunteersModeLocal.value = volunteersSettings.value.mode || 'INTERNAL'
    volunteersExternalUrlLocal.value = volunteersSettings.value.externalUrl || ''
    volunteersUpdatedAt.value = new Date()
    volunteersInitialized.value = true
  }
}

// Handler pour le toggle d'ouverture des candidatures
const handleToggleOpen = async (val: boolean) => {
  if (!volunteersInitialized.value) return
  const previous = !val

  try {
    const updatedSettings = await updateSettings({ open: val })

    if (updatedSettings) {
      volunteersUpdatedAt.value = new Date()
      await editionStore.fetchEditionById(editionId, { force: true })
      toast.add({
        title: t('common.saved') || 'Sauvegardé',
        color: 'success',
        icon: 'i-heroicons-check-circle',
      })
    }
  } catch (e: any) {
    volunteersOpenLocal.value = previous
    toast.add({
      title: e?.data?.message || e?.message || t('common.error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  }
}

// Handler pour le changement de mode
const handleChangeMode = async (_raw: any) => {
  if (!volunteersInitialized.value) return
  await persistVolunteerSettings()
}

// Persister les paramètres bénévoles (mode et URL externe)
const persistVolunteerSettings = async (options: { skipRefetch?: boolean } = {}) => {
  try {
    const body: any = {
      mode: volunteersModeLocal.value,
    }
    if (volunteersModeLocal.value === 'EXTERNAL') {
      body.externalUrl = volunteersExternalUrlLocal.value.trim() || undefined
    }

    const updatedSettings = await updateSettings(body)

    if (updatedSettings) {
      volunteersUpdatedAt.value = new Date()

      if (!options.skipRefetch && edition.value) {
        await editionStore.fetchEditionById(editionId, { force: true })
      }

      toast.add({
        title: t('common.saved') || 'Sauvegardé',
        color: 'success',
        icon: 'i-heroicons-check-circle',
      })
    }
  } catch (error: any) {
    if (fieldErrors.value && Object.keys(fieldErrors.value).length > 0) {
      toast.add({
        title: 'Erreurs de validation',
        description: 'Veuillez corriger les erreurs dans le formulaire',
        color: 'error',
        icon: 'i-heroicons-x-circle',
      })
    } else {
      toast.add({
        title: error?.data?.message || error?.message || t('common.error'),
        color: 'error',
        icon: 'i-heroicons-x-circle',
      })
    }
  }
}

// Watchers
watch(volunteersSettings, (val) => {
  // N'appliquer que lors de l'initialisation, pas après chaque mise à jour
  if (val && !volunteersInitialized.value) {
    applyVolunteerSettings()
  }
})

// Charger l'édition et les paramètres si nécessaire
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }

  // Charger les paramètres des bénévoles
  await fetchVolunteersSettings()
  applyVolunteerSettings()
})

useSeoMeta({
  title: () => t('gestion.volunteers.config_title'),
})
</script>
