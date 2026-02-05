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
      <!-- Bouton retour -->
      <div class="mb-6">
        <UButton
          icon="i-heroicons-arrow-left"
          variant="ghost"
          @click="router.push(`/editions/${editionId}/gestion/ticketing/counter`)"
        >
          {{ $t('common.back') }}
        </UButton>
      </div>

      <div v-if="loading" class="text-center py-12">
        <UIcon name="i-heroicons-arrow-path" class="animate-spin h-8 w-8 text-gray-400 mx-auto" />
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          {{ $t('ticketing.counters.loading') }}
        </p>
      </div>

      <div v-else-if="error" class="mb-6">
        <UAlert
          icon="i-heroicons-exclamation-triangle"
          color="error"
          variant="soft"
          :title="$t('common.error')"
          :description="error"
        />
      </div>

      <div v-else-if="counter" class="space-y-6">
        <!-- En-tête avec nom et infos connexion -->
        <UCard>
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ counter.name }}
              </h1>
              <div class="flex items-center gap-2">
                <div
                  class="flex items-center gap-2 px-3 py-1 rounded-full"
                  :class="
                    isConnected
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  "
                >
                  <div
                    class="w-2 h-2 rounded-full"
                    :class="isConnected ? 'bg-green-500' : 'bg-red-500'"
                  />
                  <span class="text-sm font-medium">
                    {{
                      isConnected
                        ? $t('ticketing.counters.connected')
                        : $t('ticketing.counters.disconnected')
                    }}
                  </span>
                </div>
                <div
                  class="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-700 dark:text-gray-300"
                >
                  <UIcon name="i-heroicons-users" />
                  <span class="text-sm font-medium">{{ activeConnections }}</span>
                </div>
              </div>
            </div>
          </div>
        </UCard>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <!-- Compteur principal -->
          <UCard>
            <div class="space-y-6">
              <!-- Valeur du compteur -->
              <div class="text-center">
                <div class="text-7xl font-bold text-primary-600 mb-4">
                  {{ displayValue }}
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  {{ $t('ticketing.counters.current_value') }}
                </p>
                <!-- Indicateur de synchronisation -->
                <div v-if="isSyncing || pendingCount > 0" class="mt-3">
                  <div class="flex items-center justify-center gap-2">
                    <UIcon
                      v-if="isSyncing"
                      name="i-heroicons-arrow-path"
                      class="animate-spin text-primary-500"
                    />
                    <span class="text-xs text-primary-600 dark:text-primary-400 font-medium">
                      <template v-if="isSyncing">
                        {{ $t('ticketing.counters.syncing') }}
                      </template>
                      <template v-else>
                        {{ $t('ticketing.counters.pending_operations', { count: pendingCount }) }}
                      </template>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Configuration du step -->
              <div class="flex items-center justify-center gap-3">
                <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {{ $t('ticketing.counters.step') }}:
                </label>
                <div class="flex items-center gap-2">
                  <UButton
                    icon="i-heroicons-minus"
                    variant="outline"
                    size="sm"
                    :disabled="step <= 1"
                    @click="step = Math.max(1, step - 1)"
                  />
                  <UInput v-model.number="step" type="number" min="1" class="w-20 text-center" />
                  <UButton icon="i-heroicons-plus" variant="outline" size="sm" @click="step++" />
                </div>
              </div>

              <!-- Boutons de contrôle -->
              <div class="grid grid-cols-2 gap-4">
                <UButton
                  size="xl"
                  color="error"
                  block
                  :loading="isUpdating"
                  @click="handleDecrement"
                >
                  <template #leading>
                    <UIcon name="i-heroicons-minus" class="text-2xl" />
                  </template>
                  <span class="text-xl font-bold">{{ step }}</span>
                </UButton>
                <UButton
                  size="xl"
                  color="primary"
                  block
                  :loading="isUpdating"
                  @click="handleIncrement"
                >
                  <template #leading>
                    <UIcon name="i-heroicons-plus" class="text-2xl" />
                  </template>
                  <span class="text-xl font-bold">{{ step }}</span>
                </UButton>
              </div>

              <!-- Bouton de réinitialisation -->
              <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
                <UButton
                  color="neutral"
                  variant="ghost"
                  block
                  :loading="isUpdating"
                  :disabled="displayValue === 0"
                  @click="showResetModal = true"
                >
                  <template #leading>
                    <UIcon name="i-heroicons-arrow-path" />
                  </template>
                  {{ $t('ticketing.counters.reset') }}
                </UButton>
              </div>
            </div>
          </UCard>

          <!-- QR Code -->
          <UCard>
            <div class="space-y-4">
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {{ $t('ticketing.counters.qr_code_title') }}
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {{ $t('ticketing.counters.qr_code_description') }}
                </p>
              </div>

              <!-- QR Code -->
              <div
                class="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-lg"
              >
                <Qrcode :value="counterUrl" variant="default" />
                <p
                  class="mt-3 text-xs text-gray-500 dark:text-gray-400 font-mono break-all text-center"
                >
                  {{ counterUrl }}
                </p>
              </div>

              <!-- Boutons de partage et régénération -->
              <div class="space-y-3">
                <div class="grid grid-cols-2 gap-3">
                  <UButton variant="outline" block @click="copyUrl">
                    <template #leading>
                      <UIcon name="i-heroicons-clipboard-document" />
                    </template>
                    {{ $t('common.copy_link') }}
                  </UButton>
                  <UButton variant="outline" block @click="shareUrl">
                    <template #leading>
                      <UIcon name="i-heroicons-share" />
                    </template>
                    {{ $t('common.share') }}
                  </UButton>
                </div>
                <UButton
                  v-if="canManageCounter"
                  variant="outline"
                  color="warning"
                  block
                  @click="showRegenerateModal = true"
                >
                  <template #leading>
                    <UIcon name="i-heroicons-arrow-path" />
                  </template>
                  {{ $t('ticketing.counters.regenerate_token') }}
                </UButton>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Informations supplémentaires -->
        <UCard>
          <div class="space-y-3">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              {{ $t('ticketing.counters.info_title') }}
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span class="text-gray-500 dark:text-gray-400"
                  >{{ $t('ticketing.counters.created') }}:</span
                >
                <span class="ml-2 text-gray-900 dark:text-white">{{
                  formatDateTime(counter.createdAt)
                }}</span>
              </div>
              <div>
                <span class="text-gray-500 dark:text-gray-400"
                  >{{ $t('ticketing.counters.last_update') }}:</span
                >
                <span class="ml-2 text-gray-900 dark:text-white">{{
                  formatDateTime(counter.updatedAt)
                }}</span>
              </div>
            </div>
          </div>
        </UCard>

        <!-- Modal de confirmation de réinitialisation -->
        <UModal v-model:open="showResetModal" :title="$t('ticketing.counters.reset_counter')">
          <template #body>
            <div class="space-y-4">
              <UAlert
                icon="i-heroicons-exclamation-triangle"
                color="warning"
                variant="soft"
                :description="$t('ticketing.counters.reset_confirmation')"
              />
            </div>
          </template>
          <template #footer>
            <div class="flex justify-end gap-3">
              <UButton variant="outline" @click="showResetModal = false">
                {{ $t('common.cancel') }}
              </UButton>
              <UButton color="primary" :loading="isUpdating" @click="handleReset">
                {{ $t('ticketing.counters.reset') }}
              </UButton>
            </div>
          </template>
        </UModal>

        <!-- Modal de confirmation de régénération du token -->
        <ConfirmModal
          v-if="canManageCounter"
          v-model="showRegenerateModal"
          :title="$t('ticketing.counters.regenerate_token')"
          :description="$t('ticketing.counters.regenerate_token_warning')"
          :confirm-label="$t('ticketing.counters.regenerate_token')"
          confirm-color="warning"
          icon-name="i-heroicons-exclamation-triangle"
          icon-color="text-orange-500"
          :loading="isRegenerating"
          @confirm="handleRegenerateToken"
          @cancel="showRegenerateModal = false"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ConfirmModal from '~/components/ui/ConfirmModal.vue'
import { useTicketingCounter } from '~/composables/useTicketingCounter'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

const route = useRoute()
const router = useRouter()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const token = route.params.counterId as string
const edition = computed(() => editionStore.getEditionById(editionId))

const {
  counter,
  displayValue,
  loading,
  error,
  activeConnections,
  isConnected,
  isUpdating,
  isSyncing,
  pendingCount,
  increment,
  decrement,
  reset,
  init,
  disconnect,
} = useTicketingCounter(editionId, token)

const step = ref(1)
const showResetModal = ref(false)
const showRegenerateModal = ref(false)
const isRegenerating = ref(false)

// URL du compteur pour le QR code (utilise le token pour la sécurité)
const counterUrl = computed(() => {
  if (import.meta.client) {
    return `${window.location.origin}/editions/${editionId}/gestion/ticketing/counter/${token}`
  }
  return ''
})

// Vérifier l'accès à cette page (tout utilisateur authentifié peut accéder)
const canAccess = computed(() => {
  // Vérifier que l'utilisateur est authentifié
  return !!authStore.user?.id
})

// Vérifier si l'utilisateur peut gérer le compteur (régénérer le token)
const canManageCounter = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const handleIncrement = async () => {
  try {
    await increment(step.value)
  } catch {
    // L'erreur est déjà affichée dans le composable
  }
}

const handleDecrement = async () => {
  try {
    await decrement(step.value)
  } catch {
    // L'erreur est déjà affichée dans le composable
  }
}

const handleReset = async () => {
  try {
    await reset()
    toast.add({
      title: t('common.success'),
      description: t('ticketing.counters.counter_reset'),
      color: 'success',
    })
    showResetModal.value = false
  } catch {
    // L'erreur est déjà affichée dans le composable
  }
}

const copyUrl = async () => {
  try {
    await navigator.clipboard.writeText(counterUrl.value)
    toast.add({
      title: t('common.success'),
      description: t('common.link_copied'),
      color: 'success',
    })
  } catch {
    toast.add({
      title: t('common.error'),
      description: t('common.copy_error'),
      color: 'error',
    })
  }
}

const shareUrl = async () => {
  try {
    if (navigator.share) {
      await navigator.share({
        title: counter.value?.name || t('ticketing.counters.title'),
        text: t('ticketing.counters.share_text'),
        url: counterUrl.value,
      })
    } else {
      await copyUrl()
    }
  } catch (err) {
    console.error('Error sharing:', err)
  }
}

const handleRegenerateToken = async () => {
  try {
    isRegenerating.value = true

    const response = await $fetch(
      `/api/editions/${editionId}/ticketing/counters/${token}/regenerate-token`,
      {
        method: 'PATCH',
      }
    )

    if (response.success && response.token) {
      // Déconnecter la connexion SSE actuelle avant de changer d'URL
      disconnect()

      // Afficher le toast de succès
      toast.add({
        title: t('common.success'),
        description: t('ticketing.counters.token_regenerated'),
        color: 'success',
      })

      // Fermer la modal
      showRegenerateModal.value = false

      // Utiliser replace au lieu de push pour remplacer l'URL sans déclencher onBeforeRouteLeave
      // On utilise nextTick pour s'assurer que la déconnexion SSE est complète
      await nextTick()
      window.location.href = `/editions/${editionId}/gestion/ticketing/counter/${response.token}`
    }
  } catch (error) {
    console.error('Error regenerating token:', error)
    toast.add({
      title: t('common.error'),
      description: t('ticketing.counters.regenerate_token_error'),
      color: 'error',
    })
  } finally {
    isRegenerating.value = false
  }
}

// Charger l'édition si nécessaire
onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
    }
  }

  // Initialiser le compteur (fetch + SSE)
  await init()
})

// Déconnecter explicitement avant de quitter la page
onBeforeRouteLeave(() => {
  console.log('[Counter Page] Navigation détectée - Déconnexion SSE')
  disconnect()
})

// Métadonnées de la page
useSeoMeta({
  title: computed(
    () =>
      (counter.value?.name || t('ticketing.counters.title')) +
      ' - ' +
      (edition.value?.name || 'Édition')
  ),
  description: t('ticketing.counters.description'),
})
</script>
