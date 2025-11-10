<template>
  <div>
    <!-- Breadcrumb -->
    <nav class="flex mb-4" :aria-label="$t('navigation.breadcrumb')">
      <ol class="inline-flex items-center space-x-1 md:space-x-3">
        <li class="inline-flex items-center">
          <NuxtLink
            to="/admin"
            class="inline-flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 dark:text-gray-400 dark:hover:text-white"
          >
            <UIcon name="i-heroicons-squares-2x2" class="w-4 h-4 mr-2" />
            {{ $t('admin.dashboard') }}
          </NuxtLink>
        </li>
        <li>
          <div class="flex items-center">
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 text-gray-400" />
            <span class="ml-1 text-sm font-medium text-gray-500 md:ml-2 dark:text-gray-400">{{
              $t('admin.api_error_logs')
            }}</span>
          </div>
        </li>
      </ol>
    </nav>

    <!-- En-tête -->
    <div class="mb-8">
      <div class="flex justify-between items-start">
        <div>
          <h1 class="text-3xl font-bold flex items-center gap-3">
            <UIcon name="i-heroicons-exclamation-triangle" class="text-red-600" />
            {{ $t('admin.api_error_logs') }}
          </h1>
          <p class="text-gray-600 dark:text-gray-400 mt-2">
            Surveillance et résolution des erreurs de l'API
          </p>
        </div>
        <div class="flex gap-3">
          <UButton
            icon="i-heroicons-trash"
            color="red"
            variant="outline"
            :loading="cleaningOldLogs"
            @click="cleanupOldLogs"
          >
            Nettoyer logs > 1 mois
          </UButton>
          <UButton
            icon="i-heroicons-arrow-path"
            variant="outline"
            :loading="loading"
            @click="refreshLogs"
          >
            Actualiser
          </UButton>
        </div>
      </div>
    </div>

    <!-- Statistiques rapides -->
    <div class="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('admin.errors_24h') }}
            </p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">
              {{ stats.totalLast24h }}
            </p>
          </div>
          <UIcon name="i-heroicons-clock" class="h-8 w-8 text-blue-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('admin.unresolved') }}
            </p>
            <p class="text-2xl font-bold text-red-600">
              {{ stats.unresolvedCount }}
            </p>
          </div>
          <UIcon name="i-heroicons-exclamation-circle" class="h-8 w-8 text-red-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              {{ $t('admin.main_type') }}
            </p>
            <p class="text-lg font-bold text-gray-900 dark:text-white">
              {{ stats.errorTypes[0]?.type || 'N/A' }}
            </p>
            <p class="text-xs text-gray-500">{{ stats.errorTypes[0]?.count || 0 }} occurrences</p>
          </div>
          <UIcon name="i-heroicons-bug-ant" class="h-8 w-8 text-yellow-500" />
        </div>
      </UCard>

      <UCard>
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-600 dark:text-gray-400">
              Code d'erreur principal
            </p>
            <p class="text-lg font-bold text-gray-900 dark:text-white">
              {{ stats.statusCodes[0]?.code || 'N/A' }}
            </p>
            <p class="text-xs text-gray-500">{{ stats.statusCodes[0]?.count || 0 }} occurrences</p>
          </div>
          <UIcon name="i-heroicons-signal-slash" class="h-8 w-8 text-purple-500" />
        </div>
      </UCard>
    </div>

    <!-- Filtres -->
    <UCard class="mb-6">
      <div class="flex flex-wrap gap-4">
        <div class="flex-1 min-w-64">
          <UInput
            v-model="filters.search"
            icon="i-heroicons-magnifying-glass"
            :placeholder="$t('admin.search_error_messages')"
            @input="debouncedSearch"
          />
        </div>

        <USelect
          v-model="filters.status"
          :items="statusOptions"
          class="w-40"
          @change="applyFilters"
        />

        <USelect
          v-model="filters.errorType"
          :items="errorTypeOptions"
          class="w-48"
          @change="applyFilters"
        />

        <UInput
          v-model="filters.path"
          icon="i-heroicons-link"
          :placeholder="$t('admin.api_path')"
          class="w-48"
          @input="debouncedSearch"
        />

        <UButton icon="i-heroicons-x-mark" variant="outline" color="neutral" @click="clearFilters">
          Effacer
        </UButton>
      </div>
    </UCard>

    <!-- Table des logs -->
    <UCard>
      <div class="overflow-hidden">
        <!-- En-tête du tableau -->
        <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex justify-between items-center">
            <h3 class="text-lg font-medium">
              Logs d'erreurs
              <UBadge color="neutral" variant="soft">{{ pagination.total }}</UBadge>
            </h3>
            <div class="flex items-center gap-4">
              <!-- Sélecteur de taille de page -->
              <USelect
                v-model="pagination.pageSize"
                :items="pageSizeOptions"
                class="w-20"
                @change="changePageSize"
              />
              <span class="text-sm text-gray-500">{{ $t('admin.per_page') }}</span>
            </div>
          </div>
        </div>

        <!-- Liste des logs -->
        <div v-if="loading" class="p-8 text-center">
          <UIcon
            name="i-heroicons-arrow-path"
            class="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400"
          />
          <p class="text-gray-500">{{ $t('admin.loading_logs') }}</p>
        </div>

        <div v-else-if="logs.length === 0" class="p-8 text-center">
          <UIcon name="i-heroicons-check-circle" class="h-12 w-12 text-green-400 mx-auto mb-4" />
          <p class="text-gray-500 mb-2">{{ $t('admin.no_errors_found') }}</p>
          <p class="text-sm text-gray-400">{{ $t('admin.good_news') }}</p>
        </div>

        <div v-else class="divide-y divide-gray-200 dark:divide-gray-700">
          <div
            v-for="log in logs"
            :key="log.id"
            class="p-6 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            @click="openLogDetails(log)"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0">
                <!-- Première ligne : message et métadonnées -->
                <div class="flex items-start justify-between mb-2">
                  <div class="flex-1 min-w-0">
                    <h4 class="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {{ log.message }}
                    </h4>
                    <div class="mt-1 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                      <span class="flex items-center gap-1">
                        <UIcon name="i-heroicons-calendar" />
                        {{ formatDateTime(log.createdAt) }}
                      </span>
                      <span class="flex items-center gap-1">
                        <UIcon name="i-heroicons-link" />
                        {{ log.method }} {{ log.path }}
                      </span>
                      <span v-if="log.user" class="flex items-center gap-1">
                        <UIcon name="i-heroicons-user" />
                        {{ log.user.pseudo }}
                      </span>
                      <span v-if="log.ip" class="flex items-center gap-1">
                        <UIcon name="i-heroicons-globe-alt" />
                        {{ log.ip }}
                      </span>
                      <span v-if="log.referer" class="flex items-center gap-1">
                        <UIcon name="i-heroicons-arrow-left-on-rectangle" />
                        {{ truncateUrl(log.referer) }}
                      </span>
                    </div>
                  </div>

                  <!-- Badges de statut -->
                  <div class="flex items-center gap-2 ml-4">
                    <UBadge :color="getStatusCodeColor(log.statusCode)" variant="subtle">
                      {{ log.statusCode }}
                    </UBadge>

                    <UBadge v-if="log.errorType" color="neutral" variant="outline">
                      {{ log.errorType }}
                    </UBadge>

                    <UBadge
                      :color="log.resolved ? 'success' : 'error'"
                      :variant="log.resolved ? 'subtle' : 'solid'"
                    >
                      {{ log.resolved ? 'Résolu' : 'Non résolu' }}
                    </UBadge>
                  </div>
                </div>

                <!-- Notes admin si présentes -->
                <div v-if="log.adminNotes" class="mt-2">
                  <p class="text-sm text-blue-600 dark:text-blue-400">
                    <UIcon name="i-heroicons-chat-bubble-left" class="inline mr-1" />
                    {{ log.adminNotes }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pagination -->
        <div
          v-if="pagination.totalPages > 1"
          class="px-6 py-4 border-t border-gray-200 dark:border-gray-700"
        >
          <UPagination
            v-model:page="pagination.page"
            :total="pagination.total"
            :items-per-page="pagination.pageSize"
            @update:page="changePage"
          />
        </div>
      </div>
    </UCard>

    <!-- Slideover de détails -->
    <USlideover
      v-model:open="showLogDetails"
      :title="$t('admin.error_details')"
      side="left"
      :ui="{ content: 'w-full max-w-3xl' }"
    >
      <template #body>
        <div v-if="selectedLog" class="space-y-6">
          <!-- Date et heure -->
          <p class="text-sm text-gray-500 mb-4">
            {{ formatDateTime(selectedLog.createdAt) }}
          </p>

          <!-- Informations principales -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Code de statut
              </label>
              <UBadge :color="getStatusCodeColor(selectedLog.statusCode)">
                {{ selectedLog.statusCode }}
              </UBadge>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type d'erreur
              </label>
              <UBadge color="neutral" variant="outline">
                {{ selectedLog.errorType || 'Non défini' }}
              </UBadge>
            </div>
          </div>

          <!-- Message d'erreur -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Message d'erreur
            </label>
            <UTextarea
              :model-value="selectedLog.message"
              readonly
              :rows="3"
              variant="outline"
              class="w-full"
            />
          </div>

          <!-- Détails de la requête -->
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Détails de la requête
            </label>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <strong>{{ $t('log.method') }}:</strong> {{ selectedLog.method }}
              </div>
              <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <strong>{{ $t('log.path') }}:</strong> {{ selectedLog.path }}
              </div>
              <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded col-span-2">
                <strong>{{ $t('log.full_url') }}:</strong> {{ selectedLog.url }}
              </div>
              <div v-if="selectedLog.ip" class="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <strong>{{ $t('log.ip') }}:</strong> {{ selectedLog.ip }}
              </div>
              <div v-if="selectedLog.user" class="p-3 bg-gray-50 dark:bg-gray-800 rounded">
                <strong>{{ $t('log.user') }}:</strong> {{ selectedLog.user.pseudo }} ({{
                  selectedLog.user.email
                }})
              </div>
              <div
                v-if="selectedLog.referer"
                class="p-3 bg-gray-50 dark:bg-gray-800 rounded col-span-2"
              >
                <strong>{{ $t('admin.error_logs.referer_page') }}</strong>
                <a
                  :href="selectedLog.referer"
                  target="_blank"
                  class="text-blue-600 dark:text-blue-400 hover:underline break-all"
                >
                  {{ selectedLog.referer }}
                </a>
              </div>
              <div
                v-if="selectedLog.origin"
                class="p-3 bg-gray-50 dark:bg-gray-800 rounded col-span-2"
              >
                <strong>{{ $t('admin.error_logs.origin_domain') }}</strong> {{ selectedLog.origin }}
              </div>
            </div>
          </div>

          <!-- Body POST/PUT si disponible -->
          <div v-if="selectedLog.body && Object.keys(selectedLog.body).length > 0">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Corps de la requête (body)
            </label>
            <div
              class="bg-gray-50 dark:bg-gray-800 p-3 rounded overflow-x-auto border border-gray-200 dark:border-gray-700"
            >
              <JsonViewer
                :value="selectedLog.body"
                :expand-depth="2"
                copyable
                boxed
                sort
                theme="dark"
              />
            </div>
          </div>

          <!-- Stack trace si disponible -->
          <div v-if="selectedLog.stack">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Stack trace
            </label>
            <UTextarea
              :model-value="selectedLog.stack"
              readonly
              :rows="10"
              variant="outline"
              class="w-full font-mono text-xs"
            />
          </div>

          <!-- Paramètres de requête -->
          <div v-if="selectedLog.queryParams && Object.keys(selectedLog.queryParams).length > 0">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Paramètres de requête
            </label>
            <div
              class="bg-gray-50 dark:bg-gray-800 p-3 rounded overflow-x-auto border border-gray-200 dark:border-gray-700"
            >
              <JsonViewer
                :value="selectedLog.queryParams"
                :expand-depth="3"
                copyable
                boxed
                sort
                theme="dark"
              />
            </div>
          </div>

          <!-- Headers HTTP -->
          <div v-if="selectedLog.headers && Object.keys(selectedLog.headers).length > 0">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              En-têtes HTTP
            </label>
            <div
              class="bg-gray-50 dark:bg-gray-800 p-3 rounded overflow-x-auto border border-gray-200 dark:border-gray-700"
            >
              <JsonViewer
                :value="selectedLog.headers"
                :expand-depth="1"
                copyable
                boxed
                sort
                theme="dark"
              />
            </div>
          </div>

          <!-- Section de résolution -->
          <div class="border-t pt-6">
            <div class="flex items-center justify-between mb-4">
              <h4 class="text-md font-medium">{{ $t('log.resolution') }}</h4>
              <UBadge
                :color="selectedLog.resolved ? 'success' : 'error'"
                :variant="selectedLog.resolved ? 'subtle' : 'solid'"
              >
                {{ selectedLog.resolved ? 'Résolu' : 'Non résolu' }}
              </UBadge>
            </div>

            <div class="space-y-4">
              <!-- Notes administrateur -->
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notes administrateur
                </label>
                <UTextarea
                  v-model="selectedLog.adminNotes"
                  :placeholder="$t('log.add_admin_notes')"
                  :rows="3"
                  class="w-full"
                />
              </div>

              <!-- Actions -->
              <div class="flex flex-wrap gap-3">
                <UButton
                  v-if="!selectedLog.resolved"
                  color="success"
                  :loading="resolving"
                  @click="resolveLog(true)"
                >
                  Marquer comme résolu
                </UButton>
                <UButton
                  v-else
                  color="error"
                  variant="outline"
                  :loading="resolving"
                  @click="resolveLog(false)"
                >
                  Marquer comme non résolu
                </UButton>

                <UButton
                  v-if="!selectedLog.resolved"
                  color="warning"
                  variant="outline"
                  icon="i-heroicons-squares-plus"
                  :loading="resolvingSimilar"
                  @click="resolveSimilarLogs"
                >
                  Résoudre tous les logs identiques
                </UButton>

                <UButton variant="outline" :loading="updatingNotes" @click="updateAdminNotes">
                  Sauvegarder les notes
                </UButton>
              </div>
            </div>
          </div>
        </div>
      </template>
    </USlideover>
  </div>
</template>

<script setup lang="ts">
import { shallowRef } from 'vue'
// Protection admin
definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

const toast = useToast()

// État réactif
const loading = ref(false)
const logs = shallowRef<any[]>([])
const stats = shallowRef({
  totalLast24h: 0,
  unresolvedCount: 0,
  errorTypes: [] as any[],
  statusCodes: [] as any[],
})

const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
})

const filters = ref({
  search: '',
  status: 'unresolved', // Par défaut, on cache les logs résolus
  errorType: 'all',
  path: '',
})

const cleaningOldLogs = ref(false)

// Modal de détails
const showLogDetails = ref(false)
const selectedLog = ref<any>(null)
const resolving = ref(false)
const resolvingSimilar = ref(false)
const updatingNotes = ref(false)

// Options pour les filtres (statiques)
const statusOptions = [
  { label: 'Non résolues', value: 'unresolved' },
  { label: 'Résolues', value: 'resolved' },
  { label: 'Toutes', value: 'all' },
]

const errorTypeOptions = [
  { label: 'Tous les types', value: 'all' },
  { label: 'Validation', value: 'ValidationError' },
  { label: 'Base de données', value: 'DatabaseError' },
  { label: 'Authentification', value: 'AuthenticationError' },
  { label: 'Autorisation', value: 'AuthorizationError' },
  { label: 'HTTP', value: 'HttpError' },
  { label: 'Réseau', value: 'NetworkError' },
  { label: 'Fichier', value: 'FileError' },
  { label: 'Inconnue', value: 'UnknownError' },
]

const pageSizeOptions = [
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
]

// Métadonnées de page
useSeoMeta({
  title: "Logs d'erreurs API - Administration",
  description: "Surveillance et résolution des erreurs de l'API",
})

// Fonctions utilitaires
const formatDateTime = (dateString: string) => {
  return new Date(dateString).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getStatusCodeColor = (statusCode: number) => {
  if (statusCode >= 500) return 'error'
  if (statusCode >= 400) return 'warning'
  if (statusCode >= 300) return 'warning'
  return 'success'
}

const truncateUrl = (url: string, maxLength: number = 50) => {
  if (url.length <= maxLength) return url
  try {
    const urlObj = new URL(url)
    const path = urlObj.pathname
    if (path.length > maxLength - 10) {
      return `${path.substring(0, maxLength - 13)}...`
    }
    return `${urlObj.pathname}${urlObj.search ? '?' : ''}`
  } catch {
    return url.substring(0, maxLength) + '...'
  }
}

// Chargement des logs
const loadLogs = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams()
    params.append('page', pagination.value.page.toString())
    params.append('pageSize', pagination.value.pageSize.toString())

    if (filters.value.search) params.append('search', filters.value.search)
    if (filters.value.status && filters.value.status !== 'all')
      params.append('status', filters.value.status)
    if (filters.value.errorType && filters.value.errorType !== 'all')
      params.append('errorType', filters.value.errorType)
    if (filters.value.path) params.append('path', filters.value.path)

    const response = await $fetch(`/api/admin/error-logs?${params}`)

    logs.value = response.data
    stats.value = response.stats
    pagination.value = response.pagination
  } catch (error) {
    console.error('Error loading logs:', error)
    toast.add({
      color: 'error',
      title: 'Erreur',
      description: "Impossible de charger les logs d'erreurs",
    })
  } finally {
    loading.value = false
  }
}

// Recherche avec debounce
const debouncedSearch = useDebounceFn(() => {
  pagination.value.page = 1
  loadLogs()
}, 500)

// Actions
const refreshLogs = () => {
  loadLogs()
}

const cleanupOldLogs = async () => {
  const confirmed = confirm(
    "Êtes-vous sûr de vouloir supprimer TOUS les logs de plus d'un mois (résolus et non résolus) ?\n\nCette action ne peut pas être annulée."
  )

  if (!confirmed) return

  cleaningOldLogs.value = true
  try {
    const response: any = await $fetch('/api/admin/error-logs/cleanup-old', {
      method: 'POST',
    })

    toast.add({
      color: 'success',
      title: 'Nettoyage effectué',
      description: response.message,
    })

    // Afficher les détails de la suppression
    if (response.deleted.total > 0) {
      console.log('Logs supprimés:', response.deleted)
      console.log('Logs restants:', response.remaining)
    }

    // Recharger les logs pour mettre à jour l'interface
    loadLogs()
  } catch (error: any) {
    console.error('Erreur lors du nettoyage:', error)
    toast.add({
      color: 'error',
      title: 'Erreur',
      description: error.data?.message || 'Impossible de nettoyer les logs',
    })
  } finally {
    cleaningOldLogs.value = false
  }
}

const applyFilters = () => {
  pagination.value.page = 1
  loadLogs()
}

const clearFilters = () => {
  filters.value = {
    search: '',
    status: 'unresolved', // Par défaut on affiche les non résolues
    errorType: 'all',
    path: '',
  }
  pagination.value.page = 1
  loadLogs()
}

const changePage = (page: number) => {
  pagination.value.page = page
  loadLogs()
}

const changePageSize = () => {
  pagination.value.page = 1
  loadLogs()
}

const openLogDetails = async (log: any) => {
  try {
    // Charger les détails complets du log
    const fullLog = await $fetch(`/api/admin/error-logs/${log.id}`)
    selectedLog.value = { ...fullLog, adminNotes: fullLog.adminNotes || '' }
    showLogDetails.value = true
  } catch {
    toast.add({
      color: 'error',
      title: 'Erreur',
      description: 'Impossible de charger les détails du log',
    })
  }
}

const resolveLog = async (resolved: boolean) => {
  if (!selectedLog.value) return

  resolving.value = true
  try {
    const response = await $fetch(`/api/admin/error-logs/${selectedLog.value.id}/resolve`, {
      method: 'PATCH',
      body: {
        resolved,
        adminNotes: selectedLog.value.adminNotes,
      },
    })

    selectedLog.value.resolved = resolved
    selectedLog.value.resolvedAt = resolved ? new Date().toISOString() : null

    toast.add({
      color: 'success',
      title: 'Succès',
      description: response.message,
    })

    // Recharger les logs pour mettre à jour les stats
    loadLogs()
  } catch {
    toast.add({
      color: 'error',
      title: 'Erreur',
      description: 'Impossible de mettre à jour le statut',
    })
  } finally {
    resolving.value = false
  }
}

const resolveSimilarLogs = async () => {
  if (!selectedLog.value) return

  // Demander confirmation à l'utilisateur
  const confirmed = confirm(
    `Êtes-vous sûr de vouloir marquer comme résolus TOUS les logs avec le message d'erreur suivant ?\n\n"${selectedLog.value.message}"\n\nCette action ne peut pas être annulée.`
  )

  if (!confirmed) return

  resolvingSimilar.value = true
  try {
    const response = await $fetch('/api/admin/error-logs/resolve-similar', {
      method: 'POST',
      body: {
        message: selectedLog.value.message,
        adminNotes: selectedLog.value.adminNotes || 'Résolu en masse - logs identiques',
      },
    })

    toast.add({
      color: 'success',
      title: 'Succès',
      description: response.message,
    })

    // Marquer le log actuel comme résolu dans l'interface
    selectedLog.value.resolved = true
    selectedLog.value.resolvedAt = new Date().toISOString()

    // Recharger les logs pour mettre à jour les stats et la liste
    loadLogs()
  } catch (error: any) {
    toast.add({
      color: 'error',
      title: 'Erreur',
      description: error.data?.message || 'Impossible de résoudre les logs identiques',
    })
  } finally {
    resolvingSimilar.value = false
  }
}

const updateAdminNotes = async () => {
  if (!selectedLog.value) return

  updatingNotes.value = true
  try {
    await $fetch(`/api/admin/error-logs/${selectedLog.value.id}/resolve`, {
      method: 'PATCH',
      body: {
        resolved: selectedLog.value.resolved,
        adminNotes: selectedLog.value.adminNotes,
      },
    })

    toast.add({
      color: 'success',
      title: 'Succès',
      description: 'Notes sauvegardées avec succès',
    })
  } catch {
    toast.add({
      color: 'error',
      title: 'Erreur',
      description: 'Impossible de sauvegarder les notes',
    })
  } finally {
    updatingNotes.value = false
  }
}

// Charger les données au montage
onMounted(() => {
  loadLogs()
})
</script>
