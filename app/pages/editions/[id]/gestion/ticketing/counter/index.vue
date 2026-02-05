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
          <UIcon name="i-heroicons-calculator" class="text-primary-600" />
          {{ $t('ticketing.counters.title') }}
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          {{ $t('ticketing.counters.description') }}
        </p>
      </div>

      <!-- Bouton de création -->
      <div class="mb-6">
        <UButton icon="i-heroicons-plus" color="primary" @click="showCreateModal = true">
          {{ $t('ticketing.counters.create_counter') }}
        </UButton>
      </div>

      <!-- Liste des compteurs -->
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

      <div v-else-if="counters.length === 0" class="text-center py-12">
        <UIcon name="i-heroicons-calculator" class="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          {{ $t('ticketing.counters.no_counters') }}
        </h3>
        <p class="text-gray-600 dark:text-gray-400 mb-4">
          {{ $t('ticketing.counters.no_counters_description') }}
        </p>
        <UButton icon="i-heroicons-plus" color="primary" @click="showCreateModal = true">
          {{ $t('ticketing.counters.create_first_counter') }}
        </UButton>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <UCard
          v-for="counter in counters"
          :key="counter.id"
          class="hover:shadow-lg transition-shadow cursor-pointer"
          @click="navigateToCounter(counter.token)"
        >
          <div class="space-y-3">
            <div class="flex items-start justify-between">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                {{ counter.name }}
              </h3>
              <UButton
                icon="i-heroicons-trash"
                variant="ghost"
                color="error"
                size="sm"
                @click.stop="confirmDelete(counter.id, counter.name)"
              />
            </div>

            <div class="flex items-center justify-center py-4">
              <span class="text-4xl font-bold text-primary-600">
                {{ counter.value }}
              </span>
            </div>

            <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>
                {{ $t('ticketing.counters.created') }}:
                {{ formatDate(counter.createdAt) }}
              </span>
            </div>
          </div>
        </UCard>
      </div>

      <!-- Modal de création -->
      <UModal v-model:open="showCreateModal" :title="$t('ticketing.counters.create_counter')">
        <template #body>
          <div class="space-y-4">
            <UFormField :label="$t('ticketing.counters.counter_name')" required>
              <UInput
                v-model="newCounterName"
                :placeholder="$t('ticketing.counters.counter_name_placeholder')"
                @keyup.enter="createCounter"
              />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton variant="outline" @click="showCreateModal = false">
              {{ $t('common.cancel') }}
            </UButton>
            <UButton
              color="primary"
              :loading="loading"
              :disabled="!newCounterName"
              @click="createCounter"
            >
              {{ $t('common.create') }}
            </UButton>
          </div>
        </template>
      </UModal>

      <!-- Modal de confirmation de suppression -->
      <UModal v-model:open="showDeleteModal" :title="$t('ticketing.counters.delete_counter')">
        <template #body>
          <div class="space-y-4">
            <UAlert
              icon="i-heroicons-exclamation-triangle"
              color="warning"
              variant="soft"
              :description="
                $t('ticketing.counters.delete_confirmation', { name: counterToDelete.name })
              "
            />
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-3">
            <UButton variant="outline" @click="showDeleteModal = false">
              {{ $t('common.cancel') }}
            </UButton>
            <UButton color="error" :loading="loading" @click="deleteCounter">
              {{ $t('common.delete') }}
            </UButton>
          </div>
        </template>
      </UModal>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useTicketingCountersList } from '~/composables/useTicketingCounter'
import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'

const route = useRoute()
const router = useRouter()
const editionStore = useEditionStore()
const authStore = useAuthStore()
const toast = useToast()
const { t } = useI18n()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

const {
  counters,
  loading,
  error,
  fetchCounters,
  createCounter: createCounterApi,
  deleteCounter: deleteCounterApi,
} = useTicketingCountersList(editionId)

const showCreateModal = ref(false)
const newCounterName = ref('')
const showDeleteModal = ref(false)
const counterToDelete = ref({ id: 0, name: '' })

// Vérifier l'accès à cette page (tout utilisateur authentifié peut accéder)
const canAccess = computed(() => {
  // Vérifier que l'utilisateur est authentifié
  return !!authStore.user?.id
})

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const navigateToCounter = (token: string) => {
  router.push(`/editions/${editionId}/gestion/ticketing/counter/${token}`)
}

const createCounter = async () => {
  if (!newCounterName.value) return

  try {
    const counter = await createCounterApi(newCounterName.value)
    toast.add({
      title: t('common.success'),
      description: t('ticketing.counters.counter_created'),
      color: 'success',
    })
    showCreateModal.value = false
    newCounterName.value = ''
    // Naviguer vers le nouveau compteur (utilise le token sécurisé)
    navigateToCounter(counter.token)
  } catch {
    toast.add({
      title: t('common.error'),
      description: error.value || t('ticketing.counters.create_error'),
      color: 'error',
    })
  }
}

const confirmDelete = (counterId: number, counterName: string) => {
  counterToDelete.value = { id: counterId, name: counterName }
  showDeleteModal.value = true
}

const deleteCounter = async () => {
  try {
    await deleteCounterApi(counterToDelete.value.id)
    toast.add({
      title: t('common.success'),
      description: t('ticketing.counters.counter_deleted'),
      color: 'success',
    })
    showDeleteModal.value = false
  } catch {
    toast.add({
      title: t('common.error'),
      description: error.value || t('ticketing.counters.delete_error'),
      color: 'error',
    })
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

  // Charger les compteurs
  await fetchCounters()
})

// Métadonnées de la page
useSeoMeta({
  title: t('ticketing.counters.title') + ' - ' + (edition.value?.name || 'Édition'),
  description: t('ticketing.counters.description'),
})
</script>
