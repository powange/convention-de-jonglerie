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
          <UIcon name="i-heroicons-shopping-cart" class="text-green-600 dark:text-green-400" />
          Commandes et participants
        </h1>
        <p class="text-gray-600 dark:text-gray-400 mt-1">
          Consultez les commandes importées depuis votre billeterie externe
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
              Vous devez d'abord connecter une billeterie externe (HelloAsso, etc.) pour importer
              les commandes.
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
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <UCard>
            <div class="flex items-center gap-4">
              <div class="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <UIcon name="i-heroicons-shopping-cart" class="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Commandes</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ stats.totalOrders }}
                </p>
              </div>
            </div>
          </UCard>

          <UCard>
            <div class="flex items-center gap-4">
              <div class="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <UIcon name="i-heroicons-ticket" class="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Billets</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ stats.totalItems }}
                </p>
              </div>
            </div>
          </UCard>

          <UCard>
            <div class="flex items-center gap-4">
              <div class="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <UIcon name="i-heroicons-currency-euro" class="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p class="text-sm text-gray-600 dark:text-gray-400">Montant total</p>
                <p class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ (stats.totalAmount / 100).toFixed(2) }}€
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

        <!-- Filtre de recherche -->
        <UCard>
          <div class="flex items-center gap-4">
            <UInput
              v-model="searchQuery"
              placeholder="Rechercher par nom, email..."
              icon="i-heroicons-magnifying-glass"
              class="flex-1"
              size="lg"
            />
            <UButton color="primary" variant="soft" icon="i-heroicons-funnel" size="lg">
              Filtres
            </UButton>
          </div>
        </UCard>

        <!-- Liste des commandes -->
        <div v-if="loading" class="text-center py-12">
          <UIcon name="i-heroicons-arrow-path" class="h-8 w-8 text-gray-400 animate-spin mx-auto" />
          <p class="text-sm text-gray-500 mt-2">Chargement...</p>
        </div>

        <div v-else-if="filteredOrders.length === 0" class="text-center py-12">
          <UIcon name="i-heroicons-inbox" class="h-12 w-12 text-gray-300 mb-3 mx-auto" />
          <p class="text-sm text-gray-500">
            {{ searchQuery ? 'Aucun résultat trouvé' : 'Aucune commande trouvée' }}
          </p>
          <p class="text-xs text-gray-400 mt-1">
            Importez les commandes depuis votre billeterie externe
          </p>
        </div>

        <div v-else class="space-y-4">
          <UCard
            v-for="order in filteredOrders"
            :key="order.id"
            class="hover:shadow-md transition-shadow"
          >
            <!-- En-tête de la commande -->
            <div
              class="flex items-start justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700"
            >
              <div class="flex-1">
                <div class="flex items-center gap-3 mb-2">
                  <UIcon name="i-heroicons-shopping-cart" class="h-5 w-5 text-primary-600" />
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                    {{ order.payerFirstName }} {{ order.payerLastName }}
                  </h3>
                  <UBadge
                    :color="order.status === 'Processed' ? 'success' : 'neutral'"
                    variant="soft"
                  >
                    {{ order.status }}
                  </UBadge>
                </div>
                <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <div class="flex items-center gap-1">
                    <UIcon name="i-heroicons-envelope" class="h-4 w-4" />
                    {{ order.payerEmail }}
                  </div>
                  <div class="flex items-center gap-1">
                    <UIcon name="i-heroicons-calendar" class="h-4 w-4" />
                    {{ formatDate(order.orderDate) }}
                  </div>
                  <div class="flex items-center gap-1">
                    <UIcon name="i-heroicons-hashtag" class="h-4 w-4" />
                    <span class="font-mono text-xs">{{ order.helloAssoOrderId }}</span>
                  </div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {{ (order.amount / 100).toFixed(2) }}€
                </div>
                <UBadge color="primary" variant="subtle" size="sm" class="mt-1">
                  {{ order.items?.length || 0 }} billet{{
                    (order.items?.length || 0) > 1 ? 's' : ''
                  }}
                </UBadge>
              </div>
            </div>

            <!-- Items de la commande -->
            <div class="space-y-2">
              <div
                v-for="item in order.items"
                :key="item.id"
                class="flex items-start justify-between gap-4 p-3 rounded-lg"
                :class="
                  item.entryValidated
                    ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800'
                    : 'bg-gray-50 dark:bg-gray-900/50'
                "
              >
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <UIcon
                      name="i-heroicons-ticket"
                      class="h-4 w-4 flex-shrink-0"
                      :class="item.entryValidated ? 'text-green-600' : 'text-gray-500'"
                    />
                    <span
                      class="font-medium text-sm"
                      :class="
                        item.entryValidated
                          ? 'text-gray-700 dark:text-gray-300'
                          : 'text-gray-900 dark:text-white'
                      "
                    >
                      {{ item.name || item.type }}
                    </span>
                    <UBadge v-if="item.entryValidated" color="success" variant="soft" size="xs">
                      <UIcon name="i-heroicons-check-circle" class="h-3 w-3 mr-1" />
                      Entrée validée
                    </UBadge>
                  </div>
                  <div class="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                    <div v-if="item.firstName || item.lastName">
                      <UIcon name="i-heroicons-user" class="h-3 w-3 inline mr-1" />
                      {{ item.firstName }} {{ item.lastName }}
                      <span v-if="item.email" class="ml-1">({{ item.email }})</span>
                    </div>
                    <div
                      v-if="
                        item.qrCode &&
                        item.type !== 'Donation' &&
                        item.type !== 'Membership' &&
                        item.type !== 'Payment'
                      "
                    >
                      <UButton
                        color="primary"
                        variant="soft"
                        size="xs"
                        icon="i-heroicons-qr-code"
                        @click="showQrCode(item)"
                      >
                        QR Code
                      </UButton>
                    </div>
                  </div>
                </div>
                <div class="text-right flex-shrink-0">
                  <div class="font-semibold text-sm text-primary-600 dark:text-primary-400">
                    {{ (item.amount / 100).toFixed(2) }}€
                  </div>
                  <UBadge
                    :color="item.state === 'Processed' ? 'success' : 'neutral'"
                    variant="subtle"
                    size="xs"
                    class="mt-1"
                  >
                    {{ item.state }}
                  </UBadge>
                </div>
              </div>
            </div>
          </UCard>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="flex justify-center">
            <UPagination
              v-model="currentPage"
              :total="filteredOrders.length"
              :page-size="pageSize"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Modal QR Code -->
    <UModal v-model:open="isQrModalOpen" title="QR Code du billet">
      <template #body>
        <div v-if="selectedItem" class="space-y-4">
          <!-- Informations du billet -->
          <div class="pb-4 border-b border-gray-200 dark:border-gray-700">
            <p class="font-medium text-gray-900 dark:text-white">{{ selectedItem.name }}</p>
            <p
              v-if="selectedItem.firstName || selectedItem.lastName"
              class="text-sm text-gray-600 dark:text-gray-400"
            >
              {{ selectedItem.firstName }} {{ selectedItem.lastName }}
            </p>
          </div>

          <!-- QR Code généré -->
          <div class="flex justify-center py-4">
            <Qrcode :value="selectedItem.qrCode" variant="default" />
          </div>

          <!-- Valeur brute du QR Code -->
          <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Valeur du QR Code :</p>
            <div class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <p class="text-xs font-mono text-gray-900 dark:text-white break-all">
                {{ selectedItem.qrCode }}
              </p>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useAuthStore } from '~/stores/auth'
import { useEditionStore } from '~/stores/editions'
import { fetchOrders, type Order } from '~/utils/ticketing/orders'

const route = useRoute()
const editionStore = useEditionStore()
const authStore = useAuthStore()

const editionId = parseInt(route.params.id as string)
const edition = computed(() => editionStore.getEditionById(editionId))

const loading = ref(true)
const hasExternalTicketing = ref(false)
const lastSync = ref<Date | null>(null)
const orders = ref<Order[]>([])
const stats = ref({
  totalOrders: 0,
  totalItems: 0,
  totalAmount: 0,
})

const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(20)

// Modal QR Code
const isQrModalOpen = ref(false)
const selectedItem = ref<any>(null)

const showQrCode = (item: any) => {
  selectedItem.value = item
  isQrModalOpen.value = true
}

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

const filteredOrders = computed(() => {
  if (!searchQuery.value) return orders.value

  const query = searchQuery.value.toLowerCase()
  return orders.value.filter(
    (order) =>
      order.payerFirstName.toLowerCase().includes(query) ||
      order.payerLastName.toLowerCase().includes(query) ||
      order.payerEmail.toLowerCase().includes(query) ||
      order.items?.some(
        (item: any) =>
          item.name.toLowerCase().includes(query) ||
          item.firstName?.toLowerCase().includes(query) ||
          item.lastName?.toLowerCase().includes(query) ||
          item.email?.toLowerCase().includes(query)
      )
  )
})

const totalPages = computed(() => Math.ceil(filteredOrders.value.length / pageSize.value))

const formatDate = (date: string | Date) => {
  const d = new Date(date)
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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
    // Charger la configuration
    const configResponse = await $fetch(`/api/editions/${editionId}/ticketing/external`)
    hasExternalTicketing.value = configResponse.hasConfig

    if (configResponse.hasConfig) {
      lastSync.value = configResponse.config?.lastSyncAt
        ? new Date(configResponse.config.lastSyncAt)
        : null

      // Charger les commandes depuis la BDD
      orders.value = await fetchOrders(editionId)

      // Calculer les stats
      stats.value.totalOrders = orders.value.length
      stats.value.totalItems = orders.value.reduce(
        (sum, order) => sum + (order.items?.length || 0),
        0
      )
      stats.value.totalAmount = orders.value.reduce((sum, order) => sum + order.amount, 0)
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
