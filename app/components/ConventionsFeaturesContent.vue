<template>
  <div class="space-y-6">
    <!-- Section Créateur -->
    <div>
      <h4 class="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <UIcon name="i-heroicons-user-circle" class="text-amber-500" size="18" />
        {{ $t('conventions.as_creator') }}
      </h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div :class="itemClasses">
          <UIcon
            name="i-heroicons-building-library"
            class="text-blue-500 mt-0.5 flex-shrink-0"
            size="16"
          />
          <div>
            <p class="font-medium text-sm text-gray-900 dark:text-white">
              {{ $t('conventions.create_conventions') }}
            </p>
            <p class="text-xs text-gray-600 dark:text-gray-400">
              {{ $t('conventions.create_conventions_desc') }}
            </p>
          </div>
        </div>
        <div :class="itemClasses">
          <UIcon
            name="i-heroicons-calendar-days"
            class="text-green-500 mt-0.5 flex-shrink-0"
            size="16"
          />
          <div>
            <p class="font-medium text-sm text-gray-900 dark:text-white">
              {{ $t('conventions.manage_editions') }}
            </p>
            <p class="text-xs text-gray-600 dark:text-gray-400">
              {{ $t('conventions.manage_editions_desc') }}
            </p>
          </div>
        </div>
        <div :class="itemClasses">
          <UIcon name="i-heroicons-users" class="text-purple-500 mt-0.5 flex-shrink-0" size="16" />
          <div>
            <p class="font-medium text-sm text-gray-900 dark:text-white">
              {{ $t('conventions.manage_organizers') }}
            </p>
            <p class="text-xs text-gray-600 dark:text-gray-400">
              {{ $t('conventions.manage_organizers_desc') }}
            </p>
          </div>
        </div>
        <div :class="itemClasses">
          <UIcon
            name="i-heroicons-hand-raised"
            class="text-orange-500 mt-0.5 flex-shrink-0"
            size="16"
          />
          <div>
            <p class="font-medium text-sm text-gray-900 dark:text-white">
              {{ $t('conventions.manage_volunteers') }}
            </p>
            <p class="text-xs text-gray-600 dark:text-gray-400">
              {{ $t('conventions.manage_volunteers_desc') }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Section Organisateur -->
    <div>
      <h4 class="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
        <UIcon name="i-heroicons-user-group" class="text-emerald-500" size="18" />
        {{ $t('conventions.as_organizer') }}
      </h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div :class="itemClasses">
          <UIcon name="i-heroicons-pencil" class="text-blue-500 mt-0.5 flex-shrink-0" size="16" />
          <div>
            <p class="font-medium text-sm text-gray-900 dark:text-white">
              {{ $t('conventions.edit_permissions') }}
            </p>
            <p class="text-xs text-gray-600 dark:text-gray-400">
              {{ $t('conventions.edit_permissions_desc') }}
            </p>
          </div>
        </div>
        <div :class="itemClasses">
          <UIcon
            name="i-heroicons-cog-6-tooth"
            class="text-indigo-500 mt-0.5 flex-shrink-0"
            size="16"
          />
          <div>
            <p class="font-medium text-sm text-gray-900 dark:text-white">
              {{ $t('conventions.granular_rights') }}
            </p>
            <p class="text-xs text-gray-600 dark:text-gray-400">
              {{ $t('conventions.granular_rights_desc') }}
            </p>
          </div>
        </div>
        <div :class="itemClasses">
          <UIcon name="i-heroicons-eye" class="text-teal-500 mt-0.5 flex-shrink-0" size="16" />
          <div>
            <p class="font-medium text-sm text-gray-900 dark:text-white">
              {{ $t('conventions.status_control') }}
            </p>
            <p class="text-xs text-gray-600 dark:text-gray-400">
              {{ $t('conventions.status_control_desc') }}
            </p>
          </div>
        </div>
        <div :class="itemClasses">
          <UIcon
            name="i-heroicons-chart-bar"
            class="text-pink-500 mt-0.5 flex-shrink-0"
            size="16"
          />
          <div>
            <p class="font-medium text-sm text-gray-900 dark:text-white">
              {{ $t('conventions.analytics_access') }}
            </p>
            <p class="text-xs text-gray-600 dark:text-gray-400">
              {{ $t('conventions.analytics_access_desc') }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'card' | 'modal'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'card',
})

// Classes CSS adaptées selon le variant
const itemClasses = computed(() => {
  const baseClasses =
    'flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700'

  if (props.variant === 'modal') {
    return `${baseClasses} bg-gray-50 dark:bg-gray-800`
  }

  return `${baseClasses} bg-white dark:bg-gray-800`
})
</script>
