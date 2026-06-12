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
          v-model="filters.timeRange"
          :items="timeRangeOptions"
          class="w-48"
          @change="applyFilters"
        />

        <USelect
          v-model="filters.errorType"
          :items="errorTypeOptions"
          class="w-48"
          @change="applyFilters"
        />

        <USelect
          v-model="filters.statusCode"
          :items="statusCodeOptions"
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

        <UInput
          v-model="filters.ip"
          icon="i-heroicons-globe-alt"
          :placeholder="$t('admin.filter_by_ip')"
          class="w-48"
          @input="debouncedSearch"
        />

        <UInput
          v-model="filters.user"
          icon="i-heroicons-user"
          :placeholder="$t('admin.filter_by_user')"
          class="w-56"
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
              <!-- Sélecteur de colonnes visibles -->
              <UDropdownMenu
                v-if="logs.length"
                :items="columnVisibilityItems"
                :content="{ align: 'end' }"
              >
                <UButton
                  icon="i-heroicons-view-columns"
                  color="neutral"
                  variant="outline"
                  :label="$t('admin.error_logs.columns_label')"
                />
              </UDropdownMenu>
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

        <UTable
          v-else
          ref="table"
          :data="logs"
          :columns="columns"
          class="w-full"
          :ui="{ tr: 'cursor-pointer' }"
          @select="onRowSelect"
        >
          <!-- Statut (résolu / non résolu) -->
          <template #status-cell="{ row }">
            <UIcon
              :name="
                row.original.resolved
                  ? 'i-heroicons-check-circle'
                  : 'i-heroicons-exclamation-circle'
              "
              class="h-5 w-5"
              :class="row.original.resolved ? 'text-green-500' : 'text-red-500'"
              :title="
                row.original.resolved
                  ? $t('admin.error_logs.resolved')
                  : $t('admin.error_logs.unresolved_short')
              "
            />
          </template>

          <!-- Date (triable) -->
          <template #createdAt-header>
            <UButton
              :label="$t('admin.error_logs.col_date')"
              :icon="sortIcon('createdAt')"
              color="neutral"
              variant="ghost"
              size="xs"
              class="-mx-1.5"
              @click="toggleSort('createdAt')"
            />
          </template>
          <template #createdAt-cell="{ row }">
            <div class="whitespace-nowrap">
              <p class="text-sm font-medium text-gray-900 dark:text-white">
                {{ formatRelative(row.original.createdAt) }}
              </p>
              <p class="text-xs text-gray-500">{{ formatDateTime(row.original.createdAt) }}</p>
            </div>
          </template>

          <!-- Code HTTP (triable) -->
          <template #statusCode-header>
            <UButton
              :label="$t('admin.error_logs.col_code')"
              :icon="sortIcon('statusCode')"
              color="neutral"
              variant="ghost"
              size="xs"
              class="-mx-1.5"
              @click="toggleSort('statusCode')"
            />
          </template>
          <template #statusCode-cell="{ row }">
            <UBadge :color="getStatusCodeColor(row.original.statusCode)" variant="subtle">
              {{ row.original.statusCode }}
            </UBadge>
          </template>

          <!-- Type d'erreur -->
          <template #errorType-cell="{ row }">
            <UBadge v-if="row.original.errorType" color="neutral" variant="outline">
              {{ row.original.errorType }}
            </UBadge>
            <span v-else class="text-gray-400">—</span>
          </template>

          <!-- Endpoint (méthode + path, triable par path) -->
          <template #endpoint-header>
            <UButton
              :label="$t('admin.error_logs.col_endpoint')"
              :icon="sortIcon('path')"
              color="neutral"
              variant="ghost"
              size="xs"
              class="-mx-1.5"
              @click="toggleSort('path')"
            />
          </template>
          <template #endpoint-cell="{ row }">
            <div class="flex items-center gap-2 whitespace-nowrap">
              <UBadge color="neutral" variant="soft" size="sm">{{ row.original.method }}</UBadge>
              <code class="text-xs text-gray-600 dark:text-gray-300" :title="row.original.path">
                {{ row.original.path }}
              </code>
            </div>
          </template>

          <!-- Message -->
          <template #message-cell="{ row }">
            <p
              class="max-w-md truncate text-sm text-gray-900 dark:text-white"
              :title="row.original.message"
            >
              {{ row.original.message }}
            </p>
          </template>

          <!-- Utilisateur -->
          <template #user-cell="{ row }">
            <span v-if="row.original.user" class="text-sm">{{ row.original.user.pseudo }}</span>
            <span v-else class="text-sm italic text-gray-400">
              {{ $t('admin.error_logs.anonymous') }}
            </span>
          </template>

          <!-- Page d'origine (referer) -->
          <template #referer-cell="{ row }">
            <a
              v-if="row.original.referer"
              :href="row.original.referer"
              target="_blank"
              rel="noopener"
              class="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              :title="row.original.referer"
              @click.stop
            >
              {{ truncateUrl(row.original.referer, 40) }}
            </a>
            <span v-else class="text-gray-400">—</span>
          </template>

          <!-- IP -->
          <template #ip-cell="{ row }">
            <span v-if="row.original.ip" class="font-mono text-xs text-gray-600 dark:text-gray-300">
              {{ row.original.ip }}
            </span>
            <span v-else class="text-gray-400">—</span>
          </template>

          <!-- Actions -->
          <template #actions-cell="{ row }">
            <UDropdownMenu :items="rowActions(row.original)" :content="{ align: 'end' }">
              <UButton
                icon="i-heroicons-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                square
                @click.stop
              />
            </UDropdownMenu>
          </template>
        </UTable>

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
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Corps de la requête (body)
              </label>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-copy"
                @click="copyJson(selectedLog.body)"
              >
                Copier
              </UButton>
            </div>
            <div
              class="bg-gray-50 dark:bg-gray-800 p-3 rounded overflow-x-auto border border-gray-200 dark:border-gray-700"
            >
              <JsonViewer :value="selectedLog.body" :expand-depth="2" boxed sort theme="dark" />
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
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Paramètres de requête
              </label>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-copy"
                @click="copyJson(selectedLog.queryParams)"
              >
                Copier
              </UButton>
            </div>
            <div
              class="bg-gray-50 dark:bg-gray-800 p-3 rounded overflow-x-auto border border-gray-200 dark:border-gray-700"
            >
              <JsonViewer
                :value="selectedLog.queryParams"
                :expand-depth="3"
                boxed
                sort
                theme="dark"
              />
            </div>
          </div>

          <!-- Headers HTTP -->
          <div v-if="selectedLog.headers && Object.keys(selectedLog.headers).length > 0">
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                En-têtes HTTP
              </label>
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-copy"
                @click="copyJson(selectedLog.headers)"
              >
                Copier
              </UButton>
            </div>
            <div
              class="bg-gray-50 dark:bg-gray-800 p-3 rounded overflow-x-auto border border-gray-200 dark:border-gray-700"
            >
              <JsonViewer :value="selectedLog.headers" :expand-depth="1" boxed sort theme="dark" />
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
                  :loading="resolvingSimilarLoading"
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
import { shallowRef, useTemplateRef } from 'vue'
import { JsonViewer } from 'vue3-json-viewer'
import 'vue3-json-viewer/dist/vue3-json-viewer.css'

// Protection admin
definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

const { t } = useI18n()
const toast = useToast()
const table = useTemplateRef('table')

// Copier un JSON dans le presse-papier
const copyJson = async (data: unknown) => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    toast.add({ title: 'Copié dans le presse-papier', color: 'success' })
  } catch {
    toast.add({ title: 'Impossible de copier', color: 'error' })
  }
}

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
  statusCode: 'all',
  path: '',
  ip: '',
  user: '',
  timeRange: '7d', // Par défaut, 7 jours
})

// Valeurs par défaut des filtres (utilisées pour ne pas polluer l'URL)
const FILTER_DEFAULTS = {
  search: '',
  status: 'unresolved',
  errorType: 'all',
  statusCode: 'all',
  path: '',
  ip: '',
  user: '',
  timeRange: '7d',
} as const
const DEFAULT_PAGE_SIZE = 20

const route = useRoute()
const router = useRouter()

// Modal de détails
const showLogDetails = ref(false)
const selectedLog = ref<any>(null)
const resolveResolved = ref(true)

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

const statusCodeOptions = [
  { label: 'Tous les codes', value: 'all' },
  { label: '400 - Bad Request', value: '400' },
  { label: '401 - Unauthorized', value: '401' },
  { label: '403 - Forbidden', value: '403' },
  { label: '404 - Not Found', value: '404' },
  { label: '409 - Conflict', value: '409' },
  { label: '422 - Validation Error', value: '422' },
  { label: '500 - Server Error', value: '500' },
  { label: '502 - Bad Gateway', value: '502' },
  { label: '503 - Service Unavailable', value: '503' },
]

const timeRangeOptions = [
  { label: 'Dernières 24h', value: '1d' },
  { label: '7 derniers jours', value: '7d' },
  { label: '30 derniers jours', value: '30d' },
  { label: '90 derniers jours', value: '90d' },
  { label: 'Tous', value: 'all' },
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

// ===== Tableau (UTable) =====

// Définition des colonnes. Les colonnes optionnelles (user, referer, ip) sont
// masquables via le sélecteur de colonnes ; statut et actions ne le sont pas.
const columns = computed(() => [
  {
    id: 'status',
    accessorKey: 'resolved',
    header: t('admin.error_logs.col_status'),
    enableHiding: false,
  },
  { id: 'createdAt', accessorKey: 'createdAt', header: t('admin.error_logs.col_date') },
  { id: 'statusCode', accessorKey: 'statusCode', header: t('admin.error_logs.col_code') },
  { id: 'errorType', accessorKey: 'errorType', header: t('admin.error_logs.col_type') },
  { id: 'endpoint', accessorKey: 'path', header: t('admin.error_logs.col_endpoint') },
  { id: 'message', accessorKey: 'message', header: t('admin.error_logs.col_message') },
  { id: 'user', accessorKey: 'user.pseudo', header: t('admin.error_logs.col_user') },
  { id: 'referer', accessorKey: 'referer', header: t('admin.error_logs.col_referer') },
  { id: 'ip', accessorKey: 'ip', header: t('admin.error_logs.col_ip') },
  { id: 'actions', accessorKey: 'actions', header: '', enableHiding: false },
])

// Items du menu de visibilité des colonnes (piloté par l'API TanStack du tableau)
const columnVisibilityItems = computed(() => {
  const cols = table.value?.tableApi?.getAllColumns?.() ?? []
  return cols
    .filter((column: any) => column.getCanHide())
    .map((column: any) => ({
      label: typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id,
      type: 'checkbox' as const,
      checked: column.getIsVisible(),
      onUpdateChecked(checked: boolean) {
        column.toggleVisibility(!!checked)
      },
      onSelect(e: Event) {
        e.preventDefault()
      },
    }))
})

// Tri côté serveur (les seuls champs supportés par l'API sont createdAt/statusCode/path)
const sort = ref<{ field: 'createdAt' | 'statusCode' | 'path'; dir: 'asc' | 'desc' }>({
  field: 'createdAt',
  dir: 'desc',
})

const toggleSort = (field: 'createdAt' | 'statusCode' | 'path') => {
  if (sort.value.field === field) {
    sort.value.dir = sort.value.dir === 'asc' ? 'desc' : 'asc'
  } else {
    sort.value.field = field
    sort.value.dir = 'desc'
  }
  pagination.value.page = 1
  loadLogs()
}

const sortIcon = (field: 'createdAt' | 'statusCode' | 'path') => {
  if (sort.value.field !== field) return 'i-heroicons-arrows-up-down'
  return sort.value.dir === 'asc' ? 'i-heroicons-bars-arrow-up' : 'i-heroicons-bars-arrow-down'
}

// Clic sur une ligne → ouvre le slideover de détails
const onRowSelect = (_e: Event, row: any) => {
  openLogDetails(row.original)
}

// Menu d'actions par ligne
const rowActions = (log: any) => [
  [
    {
      label: t('admin.error_logs.action_details'),
      icon: 'i-heroicons-eye',
      onSelect: () => openLogDetails(log),
    },
    {
      label: log.resolved
        ? t('admin.error_logs.action_unresolve')
        : t('admin.error_logs.action_resolve'),
      icon: log.resolved ? 'i-heroicons-x-circle' : 'i-heroicons-check-circle',
      onSelect: () => quickResolve(log, !log.resolved),
    },
    {
      label: t('admin.error_logs.action_resolve_similar'),
      icon: 'i-heroicons-check-badge',
      onSelect: () => quickResolveSimilar(log),
    },
  ],
]

// Résolution rapide depuis le tableau (sans ouvrir le slideover)
const quickResolve = async (log: any, resolved: boolean) => {
  try {
    const result: any = await $fetch(`/api/admin/error-logs/${log.id}/resolve`, {
      method: 'PATCH',
      body: { resolved, adminNotes: log.adminNotes ?? undefined },
    })
    toast.add({ color: 'success', title: 'Succès', description: result.message })
    loadLogs()
  } catch {
    toast.add({
      color: 'error',
      title: 'Erreur',
      description: 'Impossible de mettre à jour le statut',
    })
  }
}

const quickResolveSimilar = (log: any) => {
  const confirmed = confirm(
    `Êtes-vous sûr de vouloir marquer comme résolus TOUS les logs avec le message d'erreur suivant ?\n\n"${log.message}"\n\nCette action ne peut pas être annulée.`
  )
  if (!confirmed) return
  $fetch('/api/admin/error-logs/resolve-similar', {
    method: 'POST',
    body: { message: log.message, adminNotes: 'Résolu en masse - logs identiques' },
  })
    .then((result: any) => {
      toast.add({ color: 'success', title: 'Succès', description: result.message })
      loadLogs()
    })
    .catch(() => {
      toast.add({
        color: 'error',
        title: 'Erreur',
        description: 'Impossible de résoudre les logs identiques',
      })
    })
}

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

// Date relative (« il y a 5 min ») via Intl, sans dépendance externe
const relativeTimeFormat = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
const formatRelative = (dateString: string) => {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const seconds = Math.round(diffMs / 1000)
  if (seconds < 60) return relativeTimeFormat.format(-seconds, 'second')
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return relativeTimeFormat.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return relativeTimeFormat.format(-hours, 'hour')
  const days = Math.round(hours / 24)
  return relativeTimeFormat.format(-days, 'day')
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

// Construit l'objet query d'URL en n'incluant que les valeurs différentes des défauts
const buildUrlQuery = (): Record<string, string> => {
  const q: Record<string, string> = {}
  for (const key of Object.keys(FILTER_DEFAULTS) as (keyof typeof FILTER_DEFAULTS)[]) {
    const value = filters.value[key]
    if (value && value !== FILTER_DEFAULTS[key]) q[key] = String(value)
  }
  if (pagination.value.page && pagination.value.page > 1) q.page = String(pagination.value.page)
  if (pagination.value.pageSize && pagination.value.pageSize !== DEFAULT_PAGE_SIZE)
    q.pageSize = String(pagination.value.pageSize)
  return q
}

// Reflète l'état courant des filtres dans l'URL (replace pour ne pas polluer l'historique)
const syncUrl = () => {
  router.replace({ query: buildUrlQuery() })
}

// Initialise les filtres et la pagination depuis l'URL (au montage / rechargement)
const initFiltersFromUrl = () => {
  const q = route.query
  for (const key of Object.keys(FILTER_DEFAULTS) as (keyof typeof FILTER_DEFAULTS)[]) {
    if (typeof q[key] === 'string') filters.value[key] = q[key] as string
  }
  const page = parseInt(q.page as string)
  if (!isNaN(page) && page > 0) pagination.value.page = page
  const pageSize = parseInt(q.pageSize as string)
  if (!isNaN(pageSize) && pageSize > 0) pagination.value.pageSize = pageSize
}

// Chargement des logs
const loadLogs = async () => {
  loading.value = true
  // Garder l'URL synchronisée avec l'état des filtres
  syncUrl()
  try {
    const params = new URLSearchParams()
    params.append('page', (pagination.value.page || 1).toString())
    params.append('pageSize', (pagination.value.pageSize || 20).toString())

    if (filters.value.search) params.append('search', filters.value.search)
    if (filters.value.status && filters.value.status !== 'all')
      params.append('status', filters.value.status)
    if (filters.value.timeRange) params.append('timeRange', filters.value.timeRange)
    if (filters.value.errorType && filters.value.errorType !== 'all')
      params.append('errorType', filters.value.errorType)
    if (filters.value.statusCode && filters.value.statusCode !== 'all')
      params.append('statusCode', filters.value.statusCode)
    if (filters.value.path) params.append('path', filters.value.path)
    if (filters.value.ip) params.append('ip', filters.value.ip)
    if (filters.value.user) params.append('user', filters.value.user)
    params.append('sortField', sort.value.field)
    params.append('sortDir', sort.value.dir)

    const response = await $fetch(`/api/admin/error-logs?${params}`)

    logs.value = response.data || response.logs || []
    stats.value = response.stats || {
      totalLast24h: 0,
      unresolvedCount: 0,
      errorTypes: [],
      statusCodes: [],
    }

    // L'API utilise createPaginatedResponse qui retourne un objet pagination
    if (response.pagination) {
      pagination.value = {
        page: response.pagination.page || 1,
        pageSize: response.pagination.limit || 20,
        total: response.pagination.totalCount || 0,
        totalPages: response.pagination.totalPages || 1,
      }
    }
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

const { execute: executeCleanup, loading: cleaningOldLogs } = useApiAction(
  '/api/admin/error-logs/cleanup-old',
  {
    method: 'POST',
    silentSuccess: true,
    errorMessages: { default: 'Impossible de nettoyer les logs' },
    onSuccess: (result: any) => {
      toast.add({
        color: 'success',
        title: 'Nettoyage effectué',
        description: result.message,
      })
      loadLogs()
    },
  }
)

const cleanupOldLogs = () => {
  const confirmed = confirm(
    "Êtes-vous sûr de vouloir supprimer TOUS les logs de plus d'un mois (résolus et non résolus) ?\n\nCette action ne peut pas être annulée."
  )
  if (confirmed) {
    executeCleanup()
  }
}

const applyFilters = () => {
  pagination.value.page = 1
  loadLogs()
}

const clearFilters = () => {
  filters.value = { ...FILTER_DEFAULTS }
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

const { execute: executeResolveLog, loading: resolving } = useApiAction(
  () => `/api/admin/error-logs/${selectedLog.value?.id}/resolve`,
  {
    method: 'PATCH',
    body: () => ({
      resolved: resolveResolved.value,
      adminNotes: selectedLog.value?.adminNotes,
    }),
    silentSuccess: true,
    errorMessages: { default: 'Impossible de mettre à jour le statut' },
    onSuccess: (result: any) => {
      if (selectedLog.value) {
        selectedLog.value.resolved = result.resolved ?? resolveResolved.value
        selectedLog.value.resolvedAt = result.resolvedAt ?? null
      }
      toast.add({ color: 'success', title: 'Succès', description: result.message })
      loadLogs()
    },
  }
)

const resolveLog = (resolved: boolean) => {
  if (!selectedLog.value) return
  resolveResolved.value = resolved
  executeResolveLog()
}

const { execute: executeResolveSimilar, loading: resolvingSimilarLoading } = useApiAction(
  '/api/admin/error-logs/resolve-similar',
  {
    method: 'POST',
    body: () => ({
      message: selectedLog.value?.message,
      adminNotes: selectedLog.value?.adminNotes || 'Résolu en masse - logs identiques',
    }),
    silentSuccess: true,
    errorMessages: { default: 'Impossible de résoudre les logs identiques' },
    onSuccess: (result: any) => {
      toast.add({ color: 'success', title: 'Succès', description: result.message })
      if (selectedLog.value) {
        selectedLog.value.resolved = true
        selectedLog.value.resolvedAt = new Date().toISOString()
      }
      loadLogs()
    },
  }
)

const resolveSimilarLogs = () => {
  if (!selectedLog.value) return
  const confirmed = confirm(
    `Êtes-vous sûr de vouloir marquer comme résolus TOUS les logs avec le message d'erreur suivant ?\n\n"${selectedLog.value.message}"\n\nCette action ne peut pas être annulée.`
  )
  if (confirmed) executeResolveSimilar()
}

const { execute: executeUpdateNotes, loading: updatingNotes } = useApiAction(
  () => `/api/admin/error-logs/${selectedLog.value?.id}/resolve`,
  {
    method: 'PATCH',
    body: () => ({
      resolved: selectedLog.value?.resolved,
      adminNotes: selectedLog.value?.adminNotes,
    }),
    successMessage: { title: 'Succès', description: 'Notes sauvegardées avec succès' },
    errorMessages: { default: 'Impossible de sauvegarder les notes' },
  }
)

const updateAdminNotes = () => {
  if (!selectedLog.value) return
  executeUpdateNotes()
}

// Charger les données au montage (en restaurant d'abord les filtres depuis l'URL)
onMounted(() => {
  initFiltersFromUrl()
  loadLogs()
})
</script>
