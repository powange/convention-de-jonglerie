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
      <!-- En-tête avec navigation -->

      <!-- Titre de la page -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <UIcon name="i-heroicons-currency-euro" class="text-orange-600 dark:text-orange-400" />
          Tarifs et options
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Gérez les tarifs et options synchronisés depuis votre billeterie externe
        </p>
      </div>

      <!-- Message si pas de configuration -->
      <UAlert
        v-if="!hasExternalTicketing"
        icon="i-heroicons-information-circle"
        color="info"
        variant="soft"
        class="mb-6"
      >
        <template #title>Aucune billeterie externe configurée</template>
        <template #description>
          <div class="space-y-2">
            <p>
              Vous devez d'abord connecter une billeterie externe (HelloAsso, etc.) pour gérer les
              tarifs et options.
            </p>
            <UButton
              :to="`/editions/${edition.id}/gestion/ticketing/external`"
              color="primary"
              variant="soft"
              size="sm"
              icon="i-heroicons-arrow-right"
            >
              Configurer une billeterie
            </UButton>
          </div>
        </template>
      </UAlert>

      <!-- Contenu principal -->
      <div v-else class="space-y-6">
        <!-- Stats -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UCard>
            <div class="flex items-center gap-3">
              <UIcon name="i-heroicons-clock" class="h-5 w-5 text-success-600" />
              <div class="flex-1 min-w-0">
                <p class="text-sm text-gray-900 dark:text-white truncate">
                  <span class="text-gray-600 dark:text-gray-400">Sync:</span>
                  {{ lastSyncText }}
                </p>
              </div>
              <UButton
                icon="i-heroicons-arrow-path"
                color="neutral"
                variant="ghost"
                size="xs"
                :loading="refreshing"
                @click="refreshData"
              >
                Actualiser
              </UButton>
            </div>
          </UCard>
        </div>

        <!-- Tabs pour tarifs et options -->
        <UTabs v-model="activeTab" :items="tabs" variant="link">
          <template #tarifs>
            <TicketingTiersList
              :tiers="tiers"
              :loading="loading"
              :edition-id="editionId"
              @refresh="loadData"
            />
          </template>

          <template #options>
            <TicketingOptionsList
              :options="options"
              :loading="loading"
              :edition-id="editionId"
              @refresh="loadData"
            />
          </template>

          <template #customfields>
            <TicketingCustomFieldsList
              :custom-fields="customFields"
              :loading="loadingCustomFields"
              :edition-id="editionId"
              @refresh="loadCustomFields"
            />
          </template>

          <template #quotas>
            <TicketingQuotasList
              :quotas="quotas"
              :loading="loadingQuotas"
              :edition-id="editionId"
              @refresh="loadQuotas"
            />
          </template>

          <template #arestituer>
            <TicketingReturnableItemsList
              :items="returnableItems"
              :loading="loadingReturnableItems"
              :edition-id="editionId"
              @refresh="onReturnableItemsRefresh"
            />

            <!-- Articles à restituer pour les bénévoles -->
            <div class="mt-8">
              <div class="border-t border-gray-200 dark:border-gray-800 pt-8">
                <div class="mb-4">
                  <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                    Articles à restituer pour les bénévoles
                  </h2>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Ces articles seront remis à tous les bénévoles lors de leur validation d'accès
                  </p>
                </div>

                <TicketingVolunteerReturnableItemsList
                  :key="volunteerReturnableItemsKey"
                  :items="volunteerReturnableItems"
                  :loading="loadingVolunteerReturnableItems"
                  :edition-id="editionId"
                  @refresh="loadVolunteerReturnableItems"
                />
              </div>
            </div>
          </template>
        </UTabs>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { fetchOptions } from '~/utils/ticketing/options'
import { fetchTiers } from '~/utils/ticketing/tiers'

definePageMeta({
  layout: 'edition-dashboard',
})

const route = useRoute()
const router = useRouter()
const editionStore = useEditionStore()
const authStore = useAuthStore()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

// Gestion de l'onglet actif avec hash dans l'URL
const activeTab = computed({
  get() {
    const hash = route.hash.replace('#', '')
    return hash || 'tarifs'
  },
  set(tab: string) {
    router.replace({ hash: `#${tab}` })
  },
})

const loading = ref(true)
const refreshing = ref(false)
const hasExternalTicketing = ref(false)
const lastSync = ref<Date | null>(null)
const tiers = ref<any[]>([])
const options = ref<any[]>([])

// Custom fields
const loadingCustomFields = ref(true)
const customFields = ref<any[]>([])

// Quotas
const loadingQuotas = ref(true)
const quotas = ref<any[]>([])

// Items à restituer
const loadingReturnableItems = ref(true)
const returnableItems = ref<any[]>([])

// Items à restituer pour bénévoles
const loadingVolunteerReturnableItems = ref(true)
const volunteerReturnableItems = ref<any[]>([])
const volunteerReturnableItemsKey = ref(0) // Clé pour forcer le rechargement du composant

const lastSyncText = computed(() => {
  if (!lastSync.value) return 'Jamais'
  const now = new Date()
  const diff = now.getTime() - lastSync.value.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `Il y a ${days} jour${days > 1 ? 's' : ''}`
  if (hours > 0) return `Il y a ${hours} heure${hours > 1 ? 's' : ''}`
  if (minutes > 0) return `Il y a ${minutes} minute${minutes > 1 ? 's' : ''}`
  return "À l'instant"
})

const tabs = computed(() => [
  {
    label: 'Tarifs',
    icon: 'i-heroicons-ticket',
    slot: 'tarifs',
    value: 'tarifs',
    badge: tiers.value.length,
  },
  {
    label: 'Options',
    icon: 'i-heroicons-adjustments-horizontal',
    slot: 'options',
    value: 'options',
    badge: options.value.length,
  },
  {
    label: 'Champs personnalisés',
    icon: 'i-heroicons-document-text',
    slot: 'customfields',
    value: 'customfields',
    badge: customFields.value.length,
  },
  {
    label: 'Quotas',
    icon: 'i-heroicons-chart-bar',
    slot: 'quotas',
    value: 'quotas',
    badge: quotas.value.length,
  },
  {
    label: 'À restituer',
    icon: 'i-heroicons-gift',
    slot: 'arestituer',
    value: 'arestituer',
    badge: returnableItems.value.length,
  },
])

onMounted(async () => {
  if (!edition.value) {
    try {
      await editionStore.fetchEditionById(editionId, { force: true })
    } catch (error) {
      console.error('Failed to fetch edition:', error)
      return
    }
  }

  if (canAccess.value) {
    await loadData()
    await loadCustomFields()
    await loadQuotas()
    await loadReturnableItems()
    await loadVolunteerReturnableItems()
  }
})

const loadData = async () => {
  loading.value = true
  try {
    // Charger la configuration pour vérifier si une billeterie est configurée
    const configResponse = await $fetch(`/api/editions/${editionId}/ticketing/external`)
    hasExternalTicketing.value = configResponse.hasConfig

    if (configResponse.hasConfig) {
      lastSync.value = configResponse.config?.lastSyncAt
        ? new Date(configResponse.config.lastSyncAt)
        : null
    }

    // Charger les tarifs et options depuis la BDD (indépendamment de la config)
    await Promise.all([loadTiers(), loadOptions()])
  } catch (error) {
    console.error('Failed to load data:', error)
  } finally {
    loading.value = false
  }
}

const loadTiers = async () => {
  try {
    tiers.value = await fetchTiers(editionId)
  } catch (error) {
    console.error('Failed to load tiers:', error)
  }
}

const loadOptions = async () => {
  try {
    options.value = await fetchOptions(editionId)
  } catch (error) {
    console.error('Failed to load options:', error)
  }
}

const loadCustomFields = async () => {
  loadingCustomFields.value = true
  try {
    customFields.value = await $fetch(`/api/editions/${editionId}/ticketing/custom-fields`)
  } catch (error) {
    console.error('Failed to load custom fields:', error)
  } finally {
    loadingCustomFields.value = false
  }
}

const refreshData = async () => {
  if (refreshing.value) return

  refreshing.value = true
  const toast = useToast()

  try {
    // Appeler l'API pour synchroniser avec HelloAsso
    await $fetch(`/api/editions/${editionId}/ticketing/helloasso/tiers`)

    // Recharger les données
    await loadData()
    await loadCustomFields()

    toast.add({
      title: 'Données actualisées',
      description: 'Les tarifs, options et champs personnalisés ont été synchronisés avec succès',
      icon: 'i-heroicons-check-circle',
      color: 'success',
    })
  } catch (error: any) {
    console.error('Failed to refresh data:', error)
    toast.add({
      title: 'Erreur',
      description: error.data?.message || 'Impossible de synchroniser les données',
      icon: 'i-heroicons-exclamation-circle',
      color: 'error',
    })
  } finally {
    refreshing.value = false
  }
}

// Permissions
const canEdit = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canEditEdition(edition.value, authStore.user.id)
})

const canManageVolunteers = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  return editionStore.canManageVolunteers(edition.value, authStore.user.id)
})

const canAccess = computed(() => {
  if (!edition.value || !authStore.user?.id) return false
  if (authStore.user.id === edition.value.creatorId) return true
  if (canEdit.value || canManageVolunteers.value) return true
  if (edition.value.convention?.organizers) {
    return edition.value.convention.organizers.some(
      (collab) => collab.user.id === authStore.user?.id
    )
  }
  return false
})

// Fonctions pour les quotas
const loadQuotas = async () => {
  loadingQuotas.value = true
  try {
    quotas.value = await $fetch(`/api/editions/${editionId}/ticketing/quotas`)
  } catch (error) {
    console.error('Failed to load quotas:', error)
  } finally {
    loadingQuotas.value = false
  }
}

// Fonctions pour les items à restituer
const loadReturnableItems = async () => {
  loadingReturnableItems.value = true
  try {
    const response = await $fetch(`/api/editions/${editionId}/ticketing/returnable-items`)
    returnableItems.value = response.returnableItems || []
  } catch (error) {
    console.error('Failed to load returnable items:', error)
  } finally {
    loadingReturnableItems.value = false
  }
}

// Quand les articles à restituer changent, forcer un rechargement des articles bénévoles
// pour que la liste des articles disponibles se mette à jour
const onReturnableItemsRefresh = async () => {
  await loadReturnableItems()
  // Forcer un rechargement du composant bénévole en changeant la clé
  volunteerReturnableItemsKey.value++
}

// Fonctions pour les items à restituer pour bénévoles
const loadVolunteerReturnableItems = async () => {
  loadingVolunteerReturnableItems.value = true
  try {
    const response = await $fetch(
      `/api/editions/${editionId}/ticketing/volunteers/returnable-items`
    )
    volunteerReturnableItems.value = response.items
  } catch (error) {
    console.error('Failed to load volunteer returnable items:', error)
  } finally {
    loadingVolunteerReturnableItems.value = false
  }
}

// Recharger les données quand les permissions changent (mode super admin)
watch(canAccess, async (newValue, oldValue) => {
  if (newValue && !oldValue) {
    await loadData()
    await loadCustomFields()
    await loadQuotas()
    await loadReturnableItems()
    await loadVolunteerReturnableItems()
  }
})
</script>
