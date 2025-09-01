<template>
  <UCard
    class="bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border-primary-200 dark:border-primary-700"
  >
    <template #header>
      <div class="flex items-center gap-3">
        <div
          class="w-10 h-10 bg-primary-100 dark:bg-primary-900/50 rounded-lg flex items-center justify-center"
        >
          <UIcon
            name="i-heroicons-sparkles"
            class="text-primary-600 dark:text-primary-400"
            size="20"
          />
        </div>
        <div>
          <h3 class="text-lg font-semibold text-primary-900 dark:text-primary-100">
            {{ $t('conventions.features_card_title') }}
          </h3>
          <p class="text-sm text-primary-700 dark:text-primary-300">
            {{ $t('conventions.features_card_subtitle') }}
          </p>
        </div>
      </div>
    </template>

    <div class="space-y-6">
      <!-- Section Créateur -->
      <div>
        <h4 class="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <UIcon name="i-heroicons-user-circle" class="text-amber-500" size="18" />
          {{ $t('conventions.as_creator') }}
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            class="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
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
          <div
            class="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
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
          <div
            class="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
            <UIcon
              name="i-heroicons-users"
              class="text-purple-500 mt-0.5 flex-shrink-0"
              size="16"
            />
            <div>
              <p class="font-medium text-sm text-gray-900 dark:text-white">
                {{ $t('conventions.manage_collaborators') }}
              </p>
              <p class="text-xs text-gray-600 dark:text-gray-400">
                {{ $t('conventions.manage_collaborators_desc') }}
              </p>
            </div>
          </div>
          <div
            class="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
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

      <!-- Section Collaborateur -->
      <div>
        <h4 class="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <UIcon name="i-heroicons-user-group" class="text-emerald-500" size="18" />
          {{ $t('conventions.as_collaborator') }}
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            class="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
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
          <div
            class="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
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
          <div
            class="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
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
          <div
            class="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
          >
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

    <template v-if="showFooter" #footer>
      <div class="flex flex-col sm:flex-row gap-3">
        <UButton
          color="primary"
          size="sm"
          icon="i-heroicons-plus"
          :label="$t('conventions.create_first_convention')"
          to="/conventions/add"
          class="flex-1"
        />
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-heroicons-question-mark-circle"
          :label="$t('conventions.learn_more')"
          to="/help/conventions"
          class="flex-1"
        />
      </div>
    </template>
  </UCard>
</template>

<script setup lang="ts">
interface Props {
  showFooter?: boolean
}

withDefaults(defineProps<Props>(), {
  showFooter: true,
})
</script>
