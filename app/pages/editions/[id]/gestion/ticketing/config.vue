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
          <UIcon name="i-heroicons-cog-6-tooth" class="text-blue-600 dark:text-blue-400" />
          {{ $t('gestion.ticketing.config_title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('gestion.ticketing.config_page_description') }}
        </p>
      </div>

      <!-- Contenu de la page -->
      <div class="space-y-6">
        <!-- Paramètres de billetterie -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-cog-6-tooth" class="text-blue-500" />
              <h2 class="text-lg font-semibold">
                {{ $t('gestion.ticketing.settings_title') }}
              </h2>
            </div>

            <!-- Autoriser l'ajout de participant sur place -->
            <div class="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">
                    {{ $t('gestion.ticketing.allow_onsite_registration') }}
                  </h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('gestion.ticketing.allow_onsite_registration_description') }}
                  </p>
                </div>
                <UBadge
                  :color="allowOnsiteRegistration ? 'success' : 'neutral'"
                  variant="soft"
                  size="sm"
                >
                  {{ allowOnsiteRegistration ? $t('common.active') : $t('common.inactive') }}
                </UBadge>
              </div>

              <div class="flex items-center gap-3">
                <USwitch
                  v-model="allowOnsiteRegistration"
                  :disabled="updating"
                  color="primary"
                  @update:model-value="handleToggleOnsiteRegistration"
                />
                <span
                  :class="
                    allowOnsiteRegistration
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-600 dark:text-gray-400'
                  "
                >
                  {{
                    allowOnsiteRegistration
                      ? $t('gestion.ticketing.onsite_registration_enabled')
                      : $t('gestion.ticketing.onsite_registration_disabled')
                  }}
                </span>
              </div>
            </div>

            <!-- Autoriser les commandes anonymes -->
            <div class="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div class="flex items-center justify-between">
                <div>
                  <h3 class="font-medium text-gray-900 dark:text-white">
                    {{ $t('gestion.ticketing.allow_anonymous_orders') }}
                  </h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    {{ $t('gestion.ticketing.allow_anonymous_orders_description') }}
                  </p>
                </div>
                <UBadge
                  :color="allowAnonymousOrders ? 'success' : 'neutral'"
                  variant="soft"
                  size="sm"
                >
                  {{ allowAnonymousOrders ? $t('common.active') : $t('common.inactive') }}
                </UBadge>
              </div>

              <div class="flex items-center gap-3">
                <USwitch
                  v-model="allowAnonymousOrders"
                  :disabled="updating"
                  color="primary"
                  @update:model-value="handleToggleAnonymousOrders"
                />
                <span
                  :class="
                    allowAnonymousOrders
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-600 dark:text-gray-400'
                  "
                >
                  {{
                    allowAnonymousOrders
                      ? $t('gestion.ticketing.anonymous_orders_enabled')
                      : $t('gestion.ticketing.anonymous_orders_disabled')
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
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

const route = useRoute()
const authStore = useAuthStore()
const editionStore = useEditionStore()
const { t } = useI18n()
const toast = useToast()

const editionId = computed(() => parseInt(route.params.id as string))
const edition = computed(() => editionStore.getEditionById(editionId.value))

// Permissions
const isOrganizer = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.isOrganizer(edition.value, authStore.user.id)
})

const canAccess = computed(() => isOrganizer.value)

// Utiliser le composable pour gérer les paramètres
const { settings, loading, updating, fetchSettings, updateSettings } = useTicketingSettings(
  editionId.value
)

// Variables locales pour les toggles
const allowOnsiteRegistration = ref(true)
const allowAnonymousOrders = ref(false)

// Charger les données au montage
onMounted(async () => {
  if (!edition.value) {
    await editionStore.fetchEditionById(editionId.value, { force: true })
  }

  await fetchSettings()

  if (settings.value) {
    allowOnsiteRegistration.value = settings.value.allowOnsiteRegistration
    allowAnonymousOrders.value = settings.value.allowAnonymousOrders
  }
})

// Handlers pour les toggles
const handleToggleOnsiteRegistration = async (val: boolean) => {
  const previous = !val

  try {
    await updateSettings({ allowOnsiteRegistration: val })

    toast.add({
      title: t('common.saved'),
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
  } catch (e: any) {
    allowOnsiteRegistration.value = previous
    toast.add({
      title: e?.data?.message || e?.message || t('common.error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  }
}

const handleToggleAnonymousOrders = async (val: boolean) => {
  const previous = !val

  try {
    await updateSettings({ allowAnonymousOrders: val })

    toast.add({
      title: t('common.saved'),
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
  } catch (e: any) {
    allowAnonymousOrders.value = previous
    toast.add({
      title: e?.data?.message || e?.message || t('common.error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  }
}
</script>
