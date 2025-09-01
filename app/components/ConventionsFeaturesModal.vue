<template>
  <UModal
    v-model:open="isOpen"
    :title="$t('conventions.features_card_title')"
    :description="$t('conventions.features_card_subtitle')"
  >
    <template #body>
      <div class="space-y-6 p-4">
        <!-- Section Créateur -->
        <div>
          <h4 class="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <UIcon name="i-heroicons-user-circle" class="text-amber-500" size="18" />
            {{ $t('conventions.as_creator') }}
          </h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div
              class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
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
              class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
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
              class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
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
              class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
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
              class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <UIcon
                name="i-heroicons-pencil"
                class="text-blue-500 mt-0.5 flex-shrink-0"
                size="16"
              />
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
              class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
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
              class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
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
              class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
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
    </template>

    <template #footer="{ close }">
      <div class="flex justify-end gap-3">
        <UButton color="neutral" variant="outline" :label="$t('common.close')" @click="close" />
        <UButton
          color="primary"
          icon="i-heroicons-plus"
          :label="$t('conventions.create_first_convention')"
          to="/conventions/add"
          @click="close"
        />
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})
</script>
