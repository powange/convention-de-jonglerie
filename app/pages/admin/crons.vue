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
            <span class="ml-1 text-sm font-medium text-gray-500 md:ml-2 dark:text-gray-400">
              {{ $t('admin.cron_management') }}
            </span>
          </div>
        </li>
      </ol>
    </nav>

    <!-- En-tête -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold flex items-center gap-3">
        <UIcon name="i-heroicons-clock" class="text-indigo-600" />
        {{ $t('admin.cron_management') }}
      </h1>
      <p class="text-gray-600 dark:text-gray-400 mt-2">
        {{ $t('admin.cron_management_description') }}
      </p>
    </div>

    <!-- Statut du système -->
    <div class="mb-6">
      <UCard>
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <div
              class="p-3 rounded-lg"
              :class="
                systemStatus.enabled
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-red-100 dark:bg-red-900/30'
              "
            >
              <UIcon
                :name="systemStatus.enabled ? 'i-heroicons-play' : 'i-heroicons-pause'"
                class="h-6 w-6"
                :class="
                  systemStatus.enabled
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                "
              />
            </div>
            <div>
              <h3 class="font-semibold text-lg">{{ $t('admin.cron_system_status') }}</h3>
              <p class="text-gray-600 dark:text-gray-400 text-sm">
                {{
                  systemStatus.enabled
                    ? $t('admin.cron_system_active')
                    : $t('admin.cron_system_inactive')
                }}
              </p>
            </div>
          </div>
          <UBadge :color="systemStatus.enabled ? 'green' : 'red'" variant="soft" size="lg">
            {{ systemStatus.enabled ? $t('admin.active') : $t('admin.inactive') }}
          </UBadge>
        </div>
      </UCard>
    </div>

    <!-- Liste des tâches -->
    <div v-if="pending" class="text-center py-12">
      <UIcon
        name="i-heroicons-arrow-path"
        class="h-8 w-8 animate-spin mx-auto mb-4 text-gray-400"
      />
      <p class="text-gray-500">{{ $t('admin.loading_tasks') }}</p>
    </div>

    <div v-else-if="error" class="text-center py-12">
      <UIcon name="i-heroicons-exclamation-triangle" class="h-12 w-12 mx-auto mb-4 text-red-400" />
      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
        {{ $t('common.error') }}
      </h3>
      <p class="text-gray-600 dark:text-gray-400">
        {{ error.message || $t('errors.loading_error') }}
      </p>
      <UButton class="mt-4" color="primary" variant="outline" @click="refresh()">
        {{ $t('common.retry') }}
      </UButton>
    </div>

    <div v-else class="space-y-6">
      <div
        v-for="task in tasks"
        :key="task.name"
        class="border border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:shadow-lg transition-shadow"
      >
        <div class="flex items-start justify-between mb-4">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <div class="p-2 rounded-lg" :class="getCategoryColor(task.category)">
                <UIcon :name="getCategoryIcon(task.category)" class="h-5 w-5" />
              </div>
              <h3 class="text-xl font-semibold">{{ getTaskDisplayName(task.name) }}</h3>
              <UBadge :color="getCategoryBadgeColor(task.category)" variant="soft" size="sm">
                {{ task.category }}
              </UBadge>
            </div>
            <p class="text-gray-600 dark:text-gray-400 mb-3">
              {{ task.description }}
            </p>
            <div class="flex items-center gap-6 text-sm text-gray-500">
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-calendar-days" class="h-4 w-4" />
                <span>{{ task.schedule }}</span>
              </div>
              <div class="flex items-center gap-2">
                <UIcon name="i-heroicons-code-bracket" class="h-4 w-4" />
                <code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">
                  {{ task.cronExpression }}
                </code>
              </div>
            </div>
          </div>
          <div class="flex flex-col items-end gap-3">
            <UButton
              :loading="isExecutingTask(task.name)"
              :disabled="isExecutingTask(task.name)"
              color="primary"
              size="sm"
              @click="executeTask(task.name)"
            >
              <template #leading>
                <UIcon name="i-heroicons-play" />
              </template>
              {{ isExecutingTask(task.name) ? $t('admin.executing') : $t('admin.execute_now') }}
            </UButton>
            <div v-if="taskResults[task.name]" class="text-right">
              <UBadge
                :color="taskResults[task.name].success ? 'green' : 'red'"
                variant="soft"
                size="xs"
              >
                {{ taskResults[task.name].success ? $t('admin.success') : $t('admin.error') }}
              </UBadge>
              <p class="text-xs text-gray-500 mt-1">
                {{ formatExecutionTime(taskResults[task.name].timestamp) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Résultats de la dernière exécution -->
        <div
          v-if="taskResults[task.name] && taskResults[task.name].result"
          class="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
        >
          <h4 class="font-medium text-sm text-gray-900 dark:text-white mb-2">
            {{ $t('admin.last_execution_details') }}
          </h4>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div
              v-for="(value, key) in getExecutionStats(taskResults[task.name].result)"
              :key="key"
            >
              <span class="text-gray-500">{{ formatStatKey(key) }}:</span>
              <span class="font-medium ml-2">{{ value }}</span>
            </div>
          </div>
          <div class="mt-2 text-xs text-gray-500">
            {{ $t('admin.execution_time') }}: {{ taskResults[task.name].executionTime }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth-protected', 'super-admin'],
})

const { t } = useI18n()
const toast = useToast()

// Récupération des tâches
const { data: tasksData, pending, error, refresh } = await useFetch('/api/admin/tasks')

const tasks = computed(() => tasksData.value?.tasks || [])
const systemStatus = computed(() => ({
  enabled: tasksData.value?.cronEnabled || false,
}))

// État pour les exécutions
const taskResults = ref<
  Record<
    string,
    {
      success: boolean
      result?: Record<string, unknown>
      error?: string
      timestamp: string
      executionTime?: string
    }
  >
>({})

// Exécution d'une tâche
const { execute: doExecuteTask, isLoading: isExecutingTask } = useApiActionById(
  (taskName) => `/api/admin/tasks/${taskName}`,
  {
    method: 'POST',
    silentSuccess: true,
    errorMessages: { default: t('admin.task_execution_error') },
    onSuccess: (
      result: { executionTime: string; success: boolean; timestamp: string },
      taskName: string | number
    ) => {
      taskResults.value[taskName as string] = result

      toast.add({
        title: t('admin.task_executed_successfully'),
        description: t('admin.task_executed_details', {
          taskName: getTaskDisplayName(taskName as string),
          time: result.executionTime,
        }),
        icon: 'i-heroicons-check-circle',
        color: 'success',
      })
    },
  }
)

const executeTask = async (taskName: string) => {
  const result = await doExecuteTask(taskName)
  if (!result) {
    // Stocker le résultat d'erreur pour affichage dans l'UI
    taskResults.value[taskName] = {
      success: false,
      timestamp: new Date().toISOString(),
    }
  }
}

// Utilitaires de formatage
const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Notifications':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
    case 'Maintenance':
      return 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
    default:
      return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
  }
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'Notifications':
      return 'i-heroicons-bell'
    case 'Maintenance':
      return 'i-heroicons-wrench-screwdriver'
    default:
      return 'i-heroicons-cog-6-tooth'
  }
}

const getCategoryBadgeColor = (category: string) => {
  switch (category) {
    case 'Notifications':
      return 'blue'
    case 'Maintenance':
      return 'orange'
    default:
      return 'gray'
  }
}

const getTaskDisplayName = (taskName: string) => {
  const names = {
    'volunteer-reminders': t('admin.volunteer_reminders'),
    'convention-favorites-reminders': t('admin.convention_favorites_reminders'),
    'cleanup-expired-tokens': t('admin.cleanup_expired_tokens'),
    'cleanup-resolved-error-logs': t('admin.cleanup_resolved_error_logs'),
  }
  return names[taskName] || taskName
}

const formatExecutionTime = (timestamp: string) => {
  return new Date(timestamp).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const getExecutionStats = (result: Record<string, unknown>) => {
  if (!result) return {}

  const stats: Record<string, number> = {}
  Object.entries(result).forEach(([key, value]) => {
    if (key !== 'success' && key !== 'timestamp' && typeof value === 'number') {
      stats[key] = value
    }
  })
  return stats
}

const formatStatKey = (key: string) => {
  const translations = {
    slotsProcessed: t('admin.slots_processed'),
    notificationsSent: t('admin.notifications_sent'),
    editionsProcessed: t('admin.editions_processed'),
    passwordResetTokensCleaned: t('admin.password_tokens_cleaned'),
    totalCleaned: t('admin.total_cleaned'),
    resolvedLogsDeleted: t('admin.resolved_logs_deleted'),
    veryOldLogsDeleted: t('admin.very_old_logs_deleted'),
    remainingLogs: t('admin.remaining_logs'),
    unresolvedLogs: t('admin.unresolved_logs'),
  }
  return translations[key] || key
}

// SEO
useSeoMeta({
  title: t('admin.cron_management'),
  description: t('admin.cron_management_description'),
})
</script>
