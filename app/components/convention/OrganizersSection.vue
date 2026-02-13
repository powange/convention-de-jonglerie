<template>
  <div>
    <div class="flex items-center justify-between mb-3">
      <h4 class="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <UIcon name="i-heroicons-users" class="text-primary-500" size="20" />
        {{ $t('conventions.organizers') }} ({{ organizers.length }})
      </h4>
      <div v-if="canManage" class="flex gap-2">
        <UButton size="xs" variant="ghost" icon="i-heroicons-clock" @click="emit('showHistory')">
          {{ $t('conventions.history.title') }}
        </UButton>
        <UButton size="xs" variant="outline" icon="i-heroicons-plus" @click="emit('addOrganizer')">
          {{ $t('common.add') }}
        </UButton>
      </div>
    </div>

    <div v-if="organizers.length > 0">
      <div class="flex flex-wrap gap-3">
        <div
          v-for="organizer in organizers"
          :key="organizer.id"
          class="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          @click="emit('editOrganizer', organizer)"
        >
          <UiUserDisplay :user="organizer.user" size="xs">
            <template v-if="organizer.title" #datetime>
              <span class="text-xs text-gray-600 dark:text-gray-400">
                {{ organizer.title }}
              </span>
            </template>
          </UiUserDisplay>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
      <p class="text-sm text-gray-500">{{ $t('gestion.organizers.no_organizers') }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DashboardOrganizer } from '~/types'

interface Props {
  organizers: DashboardOrganizer[]
  convention: { id: number }
  canManage: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'editOrganizer', organizer: DashboardOrganizer): void
  (e: 'addOrganizer' | 'showHistory'): void
}>()
</script>
