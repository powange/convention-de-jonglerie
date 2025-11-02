<template>
  <UCard variant="subtle">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-users" class="text-primary-500" />
          <h3 class="text-lg font-semibold">{{ $t('edition.participants') }}</h3>
          <UBadge color="neutral" variant="soft">
            {{ participants?.length || 0 }}
          </UBadge>
        </div>

        <!-- Checkbox "Je participe" -->
        <ClientOnly>
          <div v-if="isAuthenticated" class="flex items-center gap-2">
            <UCheckbox
              :model-value="isAttending"
              :label="$t('edition.i_attend')"
              @update:model-value="$emit('toggle-attendance')"
            />
          </div>
        </ClientOnly>
      </div>
    </template>

    <div v-if="participants && participants.length > 0" class="flex flex-wrap gap-4 justify-center">
      <UiUserDisplay
        v-for="participant in participants"
        :key="participant.id"
        :user="participant"
        layout="vertical"
        size="md"
        class="flex-shrink-0"
      />
    </div>
    <div v-else class="text-center py-8 text-gray-500">
      <UIcon name="i-heroicons-user-plus" class="text-4xl mb-2 text-gray-400" />
      <p>{{ $t('edition.no_participants_yet') }}</p>
    </div>
  </UCard>
</template>

<script setup lang="ts">
interface Props {
  participants?: Array<{
    id: number
    pseudo: string
    firstName?: string | null
    lastName?: string | null
    profilePicture?: string | null
  }>
  isAttending: boolean
  isAuthenticated: boolean
}

defineProps<Props>()

defineEmits<{
  'toggle-attendance': []
}>()
</script>
