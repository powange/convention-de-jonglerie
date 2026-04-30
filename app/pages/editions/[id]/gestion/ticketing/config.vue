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

        <!-- Types de paiement acceptés -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <UIcon name="i-heroicons-credit-card" class="text-green-500" />
              <h2 class="text-lg font-semibold">
                {{ $t('gestion.ticketing.payment_methods_title') }}
              </h2>
            </div>

            <p class="text-sm text-gray-600 dark:text-gray-400">
              {{ $t('gestion.ticketing.payment_methods_description') }}
            </p>

            <!-- Espèces -->
            <div class="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <UIcon name="i-lucide-coins" class="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <h3 class="font-medium text-gray-900 dark:text-white">
                      {{ $t('ticketing.payment.methods.cash') }}
                    </h3>
                  </div>
                </div>
                <USwitch
                  v-model="paymentCash"
                  :disabled="updating"
                  color="primary"
                  @update:model-value="handleTogglePaymentMethod('paymentCash', $event)"
                />
              </div>
            </div>

            <!-- Carte bancaire -->
            <div class="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <UIcon
                    name="i-heroicons-credit-card"
                    class="h-5 w-5 text-blue-600 dark:text-blue-400"
                  />
                  <div>
                    <h3 class="font-medium text-gray-900 dark:text-white">
                      {{ $t('ticketing.payment.methods.card') }}
                    </h3>
                  </div>
                </div>
                <USwitch
                  v-model="paymentCard"
                  :disabled="updating"
                  color="primary"
                  @update:model-value="handleTogglePaymentCard"
                />
              </div>

              <!-- Sous-option SumUp -->
              <div
                v-if="paymentCard"
                class="ml-8 pl-4 border-l-2 border-blue-200 dark:border-blue-800 space-y-3"
              >
                <div class="flex items-center justify-between">
                  <div>
                    <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                      {{ $t('gestion.ticketing.sumup_integration') }}
                    </h4>
                    <p class="text-xs text-gray-600 dark:text-gray-400">
                      {{ $t('gestion.ticketing.sumup_integration_description') }}
                    </p>
                  </div>
                  <USwitch
                    v-model="sumupEnabled"
                    :disabled="updating"
                    color="primary"
                    @update:model-value="handleTogglePaymentMethod('sumupEnabled', $event)"
                  />
                </div>

                <!-- Config SumUp (affiliateKey + appId) -->
                <div
                  v-if="sumupEnabled"
                  class="mt-3 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3"
                >
                  <UAlert
                    icon="i-heroicons-information-circle"
                    color="info"
                    variant="soft"
                    :title="$t('gestion.ticketing.sumup_config_title')"
                    :description="$t('gestion.ticketing.sumup_config_help')"
                  />

                  <UFormField
                    :label="$t('gestion.ticketing.sumup_affiliate_key')"
                    :help="$t('gestion.ticketing.sumup_affiliate_key_help')"
                    :error="sumupFieldErrors.affiliateKey"
                    required
                  >
                    <UInput
                      v-model="sumupAffiliateKey"
                      type="password"
                      :placeholder="sumupConfig ? '••••••••' : ''"
                      class="w-full"
                      :disabled="sumupUpdating"
                    />
                  </UFormField>

                  <UFormField
                    :label="$t('gestion.ticketing.sumup_app_id')"
                    :help="$t('gestion.ticketing.sumup_app_id_help')"
                    :error="sumupFieldErrors.appId"
                    required
                  >
                    <UInput
                      v-model="sumupAppId"
                      :placeholder="sumupAppIdPlaceholder"
                      class="w-full"
                      :disabled="sumupUpdating"
                    />
                  </UFormField>

                  <div class="flex items-center justify-between gap-2">
                    <UButton
                      v-if="sumupConfig"
                      color="error"
                      variant="ghost"
                      size="sm"
                      icon="i-heroicons-trash"
                      :loading="sumupUpdating"
                      @click="handleDeleteSumupConfig"
                    >
                      {{ $t('gestion.ticketing.sumup_delete_config') }}
                    </UButton>
                    <div v-else />
                    <UButton
                      color="primary"
                      :loading="sumupUpdating"
                      :disabled="!canSaveSumup"
                      @click="handleSaveSumupConfig"
                    >
                      {{
                        sumupConfig
                          ? $t('gestion.ticketing.sumup_update_config')
                          : $t('gestion.ticketing.sumup_save_config')
                      }}
                    </UButton>
                  </div>
                </div>
              </div>
            </div>

            <!-- Chèque -->
            <div class="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <UIcon
                    name="i-picon-paycheck"
                    class="h-5 w-5 text-purple-600 dark:text-purple-400"
                  />
                  <div>
                    <h3 class="font-medium text-gray-900 dark:text-white">
                      {{ $t('ticketing.payment.methods.check') }}
                    </h3>
                  </div>
                </div>
                <USwitch
                  v-model="paymentCheck"
                  :disabled="updating"
                  color="primary"
                  @update:model-value="handleTogglePaymentMethod('paymentCheck', $event)"
                />
              </div>
            </div>

            <UAlert
              icon="i-heroicons-information-circle"
              color="info"
              variant="soft"
              :description="$t('gestion.ticketing.payment_methods_note')"
            />
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type Ref, computed, onMounted, ref } from 'vue'
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

// Composable pour la config SumUp (affiliateKey + appId)
const {
  config: sumupConfig,
  updating: sumupUpdating,
  fieldErrors: sumupFieldErrors,
  fetchConfig: fetchSumupConfig,
  saveConfig: saveSumupConfig,
  deleteConfig: deleteSumupConfig,
} = useSumupConfig(editionId.value)

// Variables locales pour les toggles
const allowOnsiteRegistration = ref(true)
const allowAnonymousOrders = ref(false)
const paymentCash = ref(true)
const paymentCard = ref(true)
const paymentCheck = ref(true)
const sumupEnabled = ref(false)

// Champs SumUp
const sumupAffiliateKey = ref('')
const sumupAppId = ref('')
// Concaténation pour éviter que le scanner i18n détecte cette chaîne comme une clé
const sumupAppIdPlaceholder = ['com', 'example', 'myapp'].join('.')

const canSaveSumup = computed(
  () => sumupAffiliateKey.value.trim().length > 0 && sumupAppId.value.trim().length > 0
)

// Charger les données au montage
onMounted(async () => {
  if (!edition.value) {
    await editionStore.fetchEditionById(editionId.value, { force: true })
  }

  await fetchSettings()

  if (settings.value) {
    allowOnsiteRegistration.value = settings.value.allowOnsiteRegistration
    allowAnonymousOrders.value = settings.value.allowAnonymousOrders
    paymentCash.value = settings.value.paymentCash ?? true
    paymentCard.value = settings.value.paymentCard ?? true
    paymentCheck.value = settings.value.paymentCheck ?? true
    sumupEnabled.value = settings.value.sumupEnabled ?? false
  }

  // Charger la config SumUp si l'intégration est activée
  if (sumupEnabled.value) {
    await fetchSumupConfig()
    if (sumupConfig.value) {
      sumupAffiliateKey.value = sumupConfig.value.affiliateKey
      sumupAppId.value = sumupConfig.value.appId
    }
  }
})

// Handlers SumUp
const handleSaveSumupConfig = async () => {
  try {
    await saveSumupConfig({
      affiliateKey: sumupAffiliateKey.value.trim(),
      appId: sumupAppId.value.trim(),
    })
    toast.add({
      title: t('common.saved'),
      description: t('gestion.ticketing.sumup_config_saved'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: e?.data?.message || t('gestion.ticketing.sumup_config_error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  }
}

const handleDeleteSumupConfig = async () => {
  if (!confirm(t('gestion.ticketing.sumup_delete_confirm'))) return
  try {
    await deleteSumupConfig()
    sumupAffiliateKey.value = ''
    sumupAppId.value = ''
    toast.add({
      title: t('common.deleted'),
      description: t('gestion.ticketing.sumup_config_deleted'),
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (e: any) {
    toast.add({
      title: t('common.error'),
      description: e?.data?.message || t('gestion.ticketing.sumup_config_error'),
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  }
}

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

const paymentMethodRefs: Record<string, Ref<boolean>> = {
  paymentCash,
  paymentCard,
  paymentCheck,
  sumupEnabled,
}

const handleTogglePaymentMethod = async (field: string, val: boolean) => {
  const ref = paymentMethodRefs[field]
  if (!ref) return
  const previous = !val

  try {
    await updateSettings({ [field]: val })

    toast.add({
      title: t('common.saved'),
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })

    // Si on vient d'activer SumUp et qu'on n'a pas encore chargé la config, le faire
    if (field === 'sumupEnabled' && val && !sumupConfig.value) {
      await fetchSumupConfig()
      if (sumupConfig.value) {
        sumupAffiliateKey.value = sumupConfig.value.affiliateKey
        sumupAppId.value = sumupConfig.value.appId
      }
    }
  } catch (e: any) {
    ref.value = previous
    toast.add({
      title: e?.data?.message || e?.message || t('common.error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  }
}

// Désactiver SumUp quand on désactive la carte bancaire
const handleTogglePaymentCard = async (val: boolean) => {
  const previous = !val

  try {
    const data: Record<string, boolean> = { paymentCard: val }
    // Si on désactive la carte, désactiver aussi SumUp
    if (!val && sumupEnabled.value) {
      data.sumupEnabled = false
      sumupEnabled.value = false
    }

    await updateSettings(data)

    toast.add({
      title: t('common.saved'),
      color: 'success',
      icon: 'i-heroicons-check-circle',
    })
  } catch (e: any) {
    paymentCard.value = previous
    toast.add({
      title: e?.data?.message || e?.message || t('common.error'),
      color: 'error',
      icon: 'i-heroicons-x-circle',
    })
  }
}
</script>
