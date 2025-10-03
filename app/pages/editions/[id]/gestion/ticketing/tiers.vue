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
            <div class="flex items-center gap-4">
              <div class="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <UIcon name="i-heroicons-ticket" class="h-6 w-6 text-primary-600" />
              </div>
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Tarifs disponibles</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ tiers.length }}
                </p>
              </div>
            </div>
          </UCard>

          <UCard>
            <div class="flex items-center gap-4">
              <div class="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <UIcon name="i-heroicons-adjustments-horizontal" class="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Options disponibles</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ options.length }}
                </p>
              </div>
            </div>
          </UCard>

          <UCard>
            <div class="flex items-center gap-4">
              <div class="p-3 bg-success-100 dark:bg-success-900/30 rounded-lg">
                <UIcon name="i-heroicons-clock" class="h-6 w-6 text-success-600" />
              </div>
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Dernière sync</p>
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ lastSyncText }}
                </p>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Tabs pour tarifs et options -->
        <UTabs :items="tabs" variant="link">
          <template #tarifs>
            <!-- Liste des tarifs -->
            <div v-if="loading" class="text-center py-12">
              <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 text-gray-400 animate-spin" />
              <p class="text-sm text-gray-500 mt-2">Chargement...</p>
            </div>

            <div v-else-if="tiers.length === 0" class="text-center py-12">
              <UIcon name="i-heroicons-inbox" class="h-12 w-12 text-gray-300 mb-3 mx-auto" />
              <p class="text-sm text-gray-500">Aucun tarif trouvé</p>
              <p class="text-xs text-gray-400 mt-1">Synchronisez depuis votre billeterie externe</p>
            </div>

            <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <UCard v-for="tier in tiers" :key="tier.id" :class="!tier.isActive && 'opacity-60'">
                <div class="space-y-3">
                  <!-- En-tête -->
                  <div class="flex items-start justify-between">
                    <h3 class="font-semibold text-gray-900 dark:text-white">
                      {{ tier.name }}
                    </h3>
                    <UBadge v-if="!tier.isActive" color="neutral" variant="soft" size="xs">
                      Inactif
                    </UBadge>
                  </div>

                  <!-- Prix -->
                  <div class="flex items-baseline gap-1">
                    <span
                      class="text-3xl font-bold"
                      :class="
                        tier.isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'
                      "
                    >
                      {{ (tier.price / 100).toFixed(2) }}
                    </span>
                    <span class="text-sm text-gray-500">€</span>
                  </div>

                  <!-- Description -->
                  <p
                    v-if="tier.description"
                    class="text-sm text-gray-600 dark:text-gray-400 line-clamp-3"
                  >
                    {{ tier.description }}
                  </p>

                  <!-- Montants min/max -->
                  <div v-if="tier.minAmount || tier.maxAmount" class="text-xs text-gray-500">
                    <div v-if="tier.minAmount" class="flex items-center gap-1">
                      <span>Min:</span>
                      <span class="font-medium">{{ (tier.minAmount / 100).toFixed(2) }}€</span>
                    </div>
                    <div v-if="tier.maxAmount" class="flex items-center gap-1">
                      <span>Max:</span>
                      <span class="font-medium">{{ (tier.maxAmount / 100).toFixed(2) }}€</span>
                    </div>
                  </div>

                  <!-- ID HelloAsso -->
                  <div class="pt-2 border-t border-gray-100 dark:border-gray-800">
                    <p class="text-xs text-gray-400 font-mono">
                      HelloAsso ID: {{ tier.helloAssoTierId }}
                    </p>
                  </div>
                </div>
              </UCard>
            </div>
          </template>

          <template #options>
            <!-- Liste des options -->
            <div v-if="loading" class="text-center py-12">
              <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 text-gray-400 animate-spin" />
              <p class="text-sm text-gray-500 mt-2">Chargement...</p>
            </div>

            <div v-else-if="options.length === 0" class="text-center py-12">
              <UIcon name="i-heroicons-inbox" class="h-12 w-12 text-gray-300 mb-3 mx-auto" />
              <p class="text-sm text-gray-500">Aucune option trouvée</p>
              <p class="text-xs text-gray-400 mt-1">Synchronisez depuis votre billeterie externe</p>
            </div>

            <div v-else class="space-y-4">
              <UCard v-for="option in options" :key="option.id">
                <div class="flex items-start justify-between gap-4">
                  <!-- Contenu -->
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-2">
                      <h3 class="font-semibold text-gray-900 dark:text-white">
                        {{ option.name }}
                      </h3>
                      <UBadge color="primary" variant="soft" size="xs">
                        {{ option.type }}
                      </UBadge>
                      <UBadge v-if="option.isRequired" color="warning" variant="soft" size="xs">
                        Obligatoire
                      </UBadge>
                    </div>

                    <p
                      v-if="option.description"
                      class="text-sm text-gray-600 dark:text-gray-400 mb-3"
                    >
                      {{ option.description }}
                    </p>

                    <!-- Choix disponibles -->
                    <div
                      v-if="option.choices && option.choices.length > 0"
                      class="flex flex-wrap gap-1.5"
                    >
                      <UBadge
                        v-for="(choice, idx) in option.choices"
                        :key="idx"
                        color="neutral"
                        variant="subtle"
                        size="sm"
                      >
                        {{ choice }}
                      </UBadge>
                    </div>

                    <!-- ID HelloAsso -->
                    <p class="text-xs text-gray-400 font-mono mt-3">
                      HelloAsso ID: {{ option.helloAssoOptionId }}
                    </p>
                  </div>
                </div>
              </UCard>
            </div>
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

      // Charger les tarifs depuis la BDD
      const tiersResponse = await $fetch(`/api/editions/${editionId}/ticketing/tiers-from-db`)
      tiers.value = tiersResponse.tiers || []
      options.value = tiersResponse.options || []
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
</script>
