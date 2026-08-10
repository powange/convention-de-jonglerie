<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-heroicons-magnifying-glass" class="h-5 w-5 text-purple-600" />
        <h2 class="text-xl font-semibold">{{ $t('admin.backup_search_title') }}</h2>
      </div>
      <p class="text-gray-600 dark:text-gray-400 text-sm mt-1">
        {{ $t('admin.backup_search_description') }}
      </p>
    </template>

    <div class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UFormField :label="$t('admin.backup_search_table')" required>
          <USelectMenu
            v-model="selectedTable"
            :items="tableNames"
            :loading="loadingSchema"
            :placeholder="$t('admin.backup_search_table_placeholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="$t('admin.backup_search_columns')" required>
          <USelectMenu
            v-model="selectedColumns"
            :items="columnNames"
            :disabled="!selectedTable"
            :placeholder="$t('admin.backup_search_columns_placeholder')"
            multiple
            class="w-full"
          />
        </UFormField>

        <UFormField :label="$t('admin.backup_search_filter_column')">
          <USelectMenu
            v-model="filterColumn"
            :items="columnNames"
            :disabled="!selectedTable"
            :placeholder="$t('admin.backup_search_filter_column_placeholder')"
            class="w-full"
          />
        </UFormField>

        <UFormField :label="$t('admin.backup_search_filter_value')">
          <UInput
            v-model="filterValue"
            :disabled="!filterColumn"
            :placeholder="$t('admin.backup_search_filter_value_placeholder')"
            class="w-full"
            @keydown.enter="canSearch && startSearch()"
          />
        </UFormField>
      </div>

      <UAlert
        v-if="filterColumn && !filterValue"
        icon="i-heroicons-information-circle"
        color="info"
        variant="soft"
        :description="$t('admin.backup_search_filter_hint')"
      />

      <div class="flex flex-wrap items-center gap-2">
        <UButton
          color="primary"
          :loading="searching"
          :disabled="!canSearch || searching"
          @click="startSearch"
        >
          <UIcon name="i-heroicons-magnifying-glass" class="h-4 w-4" />
          {{ $t('admin.backup_search_button') }}
        </UButton>
        <UButton v-if="searching" color="neutral" variant="outline" @click="stopSearch">
          <UIcon name="i-heroicons-stop" class="h-4 w-4" />
          {{ $t('admin.backup_search_stop') }}
        </UButton>
      </div>

      <!-- Progression -->
      <div v-if="searching || progress.total > 0" class="space-y-1">
        <UProgress :model-value="progress.current" :max="progress.total || 1" />
        <p class="text-xs text-gray-500">
          {{
            $t('admin.backup_search_progress', {
              current: progress.current,
              total: progress.total,
              matches: matchCount,
            })
          }}
        </p>
      </div>

      <UAlert
        v-if="errorMessage"
        icon="i-heroicons-x-circle"
        color="error"
        variant="soft"
        :description="errorMessage"
      />

      <!-- Résultats -->
      <div v-if="results.length > 0" class="space-y-3">
        <USeparator :label="$t('admin.backup_search_results')" />

        <div
          v-for="result in results"
          :key="result.filename"
          class="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
        >
          <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span class="font-medium text-sm break-all">{{ result.filename }}</span>
            <span class="text-xs text-gray-500">{{ formatDate(result.createdAt) }}</span>
          </div>

          <p v-if="result.error" class="text-sm text-red-600 dark:text-red-400">
            {{ result.error }}
          </p>
          <p v-else-if="result.tableMissing" class="text-sm text-gray-500">
            {{ $t('admin.backup_search_table_missing') }}
          </p>
          <p v-else-if="result.rows.length === 0" class="text-sm text-gray-500">
            {{ $t('admin.backup_search_no_row') }}
          </p>
          <div v-else class="space-y-2">
            <div
              v-for="(row, index) in result.rows"
              :key="index"
              class="bg-gray-50 dark:bg-gray-800/50 rounded p-2 space-y-1"
            >
              <div v-for="(value, column) in row" :key="column" class="text-sm">
                <span class="font-mono text-xs text-gray-500">{{ column }}</span>
                <pre class="whitespace-pre-wrap break-words font-sans mt-0.5">{{
                  value === null ? '—' : value
                }}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p v-else-if="finished && !errorMessage" class="text-sm text-gray-500">
        {{ $t('admin.backup_search_empty') }}
      </p>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

interface SearchableTable {
  name: string
  columns: { name: string; type: string }[]
}

interface SearchResult {
  filename: string
  createdAt: string
  rows: Record<string, unknown>[]
  tableMissing?: boolean
  error?: string
}

const { t } = useI18n()
const toast = useToast()

const tables = ref<SearchableTable[]>([])
const loadingSchema = ref(false)

const selectedTable = ref<string | undefined>()
const selectedColumns = ref<string[]>([])
const filterColumn = ref<string | undefined>()
const filterValue = ref('')

const searching = ref(false)
const finished = ref(false)
const errorMessage = ref('')
const results = ref<SearchResult[]>([])
const progress = ref({ current: 0, total: 0 })

let eventSource: EventSource | null = null

const tableNames = computed(() => tables.value.map((table) => table.name))

const columnNames = computed(
  () =>
    tables.value.find((table) => table.name === selectedTable.value)?.columns.map((c) => c.name) ??
    []
)

const matchCount = computed(() => results.value.filter((result) => result.rows.length > 0).length)

const canSearch = computed(() => Boolean(selectedTable.value) && selectedColumns.value.length > 0)

const formatDate = (dateString: string) => new Date(dateString).toLocaleString()

// Changer de table invalide les colonnes retenues pour la précédente
watch(selectedTable, () => {
  selectedColumns.value = []
  filterColumn.value = undefined
  filterValue.value = ''
})

const loadSchema = async () => {
  loadingSchema.value = true
  try {
    const response = await $fetch<{ data: { tables: SearchableTable[] } }>(
      '/api/admin/backup/searchable-schema'
    )
    tables.value = response.data.tables
  } catch {
    toast.add({
      color: 'error',
      title: t('common.error'),
      description: t('admin.backup_search_schema_error'),
    })
  } finally {
    loadingSchema.value = false
  }
}

const closeStream = () => {
  eventSource?.close()
  eventSource = null
  searching.value = false
}

const stopSearch = () => {
  closeStream()
  finished.value = true
}

const startSearch = () => {
  if (!canSearch.value) return

  closeStream()
  results.value = []
  progress.value = { current: 0, total: 0 }
  errorMessage.value = ''
  finished.value = false
  searching.value = true

  const params = new URLSearchParams({
    table: selectedTable.value as string,
    columns: selectedColumns.value.join(','),
  })
  if (filterColumn.value) {
    params.set('filterColumn', filterColumn.value)
    params.set('filterValue', filterValue.value)
  }

  // withCredentials: true pour envoyer le cookie de session
  eventSource = new EventSource(`/api/admin/backup/search?${params.toString()}`, {
    withCredentials: true,
  })

  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data)

    switch (data.type) {
      // Battement de maintien du flux : rien à afficher
      case 'ping':
        break

      case 'result':
        results.value.push({
          filename: data.filename,
          createdAt: data.createdAt,
          rows: data.rows ?? [],
          tableMissing: data.tableMissing,
          error: data.error,
        })
        progress.value = data.progress ?? progress.value
        break

      case 'done':
        finished.value = true
        closeStream()
        break

      case 'error':
        errorMessage.value = data.message || t('common.error')
        finished.value = true
        closeStream()
        break
    }
  }

  // Une coupure réseau ferme le flux sans événement `done`
  eventSource.onerror = () => {
    if (!finished.value) {
      errorMessage.value = t('admin.backup_search_stream_error')
    }
    closeStream()
  }
}

onBeforeUnmount(closeStream)

loadSchema()
</script>
