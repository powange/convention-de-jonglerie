<template>
  <UCard variant="subtle" class="mb-6">
    <template #header>
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center gap-3">
          <div v-if="convention.logo" class="shrink-0">
            <img
              :src="getImageUrl(convention.logo, 'convention', convention.id) || ''"
              :alt="convention.name"
              class="w-12 h-12 object-cover rounded-lg"
            />
          </div>
          <div
            v-else
            class="shrink-0 w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center"
          >
            <UIcon name="i-heroicons-building-library" class="text-gray-400" size="20" />
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-semibold">{{ convention.name }}</h3>
            <p class="text-xs text-gray-500">
              {{ $t('conventions.created_at') }}
              {{ new Date(convention.createdAt).toLocaleDateString() }}
            </p>
          </div>
        </div>
        <UDropdownMenu v-if="canEdit || canDelete" :items="conventionActions">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-heroicons-ellipsis-horizontal"
            size="xs"
          />
        </UDropdownMenu>
      </div>
    </template>

    <!-- Email de contact -->
    <a
      v-if="convention.email"
      :href="`mailto:${convention.email}`"
      class="text-primary-600 hover:text-primary-700 hover:underline"
    >
      {{ convention.email }}
    </a>

    <p
      v-if="convention.description"
      class="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mt-2"
    >
      {{ convention.description }}
    </p>
    <p v-else class="text-sm text-gray-400 italic mt-2">
      {{ $t('conventions.no_description') }}
    </p>
  </UCard>
</template>

<script setup lang="ts">
import type { ConventionListItem } from '~/types'

interface Props {
  convention: ConventionListItem
  canEdit: boolean
  canDelete: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'edit' | 'delete'): void
}>()

const { t } = useI18n()
const { getImageUrl } = useImageUrl()

const conventionActions = computed(() => {
  const actions = []

  if (props.canEdit) {
    actions.push({
      label: t('conventions.edit'),
      icon: 'i-heroicons-pencil',
      onSelect: () => emit('edit'),
    })
  }

  if (props.canDelete) {
    actions.push({
      label: t('conventions.delete'),
      icon: 'i-heroicons-trash',
      color: 'error' as const,
      onSelect: () => emit('delete'),
    })
  }

  return [actions]
})
</script>
