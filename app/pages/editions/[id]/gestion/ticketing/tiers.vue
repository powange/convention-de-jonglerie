<template>
  <div>
    <div v-if="editionStore.loading">
      <p>{{ $t('editions.loading_details') }}</p>
    </div>
    <div v-else-if="!edition">
      <p>{{ $t('editions.not_found') }}</p>
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
      <EditionHeader :edition="edition" current-page="gestion" />

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
            </div>
          </UCard>
        </div>

        <!-- Tabs pour tarifs et options -->
        <UTabs :items="tabs" variant="link">
          <template #tarifs>
            <TicketingTiersList
              :tiers="tiers"
              :loading="loading"
              :edition-id="editionId"
              @refresh="loadData"
            />
          </template>

          <template #options>
            <TicketingOptionsList :options="options" :loading="loading" />
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
              @refresh="loadReturnableItems"
            />
          </template>
        </UTabs>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { fetchOptions } from '~/utils/ticketing/options'
import { fetchTiers } from '~/utils/ticketing/tiers'

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

const loading = ref(true)
const hasExternalTicketing = ref(false)
const lastSync = ref<Date | null>(null)
const tiers = ref<any[]>([])
const options = ref<any[]>([])

// Quotas
const loadingQuotas = ref(true)
const quotas = ref<any[]>([])

// Items à restituer
const loadingReturnableItems = ref(true)
const returnableItems = ref<any[]>([])

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
    badge: tiers.value.length,
  },
  {
    label: 'Options',
    icon: 'i-heroicons-adjustments-horizontal',
    slot: 'options',
    badge: options.value.length,
  },
  {
    label: 'Quotas',
    icon: 'i-heroicons-chart-bar',
    slot: 'quotas',
    badge: quotas.value.length,
  },
  {
    label: 'À restituer',
    icon: 'i-heroicons-gift',
    slot: 'arestituer',
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
    await loadQuotas()
    await loadReturnableItems()
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

      // Charger les tarifs et options depuis la BDD
      const [tiersData, optionsData] = await Promise.all([
        fetchTiers(editionId),
        fetchOptions(editionId),
      ])

      tiers.value = tiersData
      options.value = optionsData
    }
  } catch (error) {
    console.error('Failed to load data:', error)
  } finally {
    loading.value = false
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
  if (edition.value.convention?.collaborators) {
    return edition.value.convention.collaborators.some(
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
    returnableItems.value = await $fetch(`/api/editions/${editionId}/ticketing/returnable-items`)
  } catch (error) {
    console.error('Failed to load returnable items:', error)
  } finally {
    loadingReturnableItems.value = false
  }
}
</script>
