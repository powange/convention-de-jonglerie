<template>
  <UAlert
    v-if="canManageVolunteers && overlapWarnings.length > 0"
    color="warning"
    variant="soft"
    icon="i-heroicons-exclamation-triangle"
    class="mt-6"
  >
    <template #title>
      {{ t('editions.volunteers.scheduling_conflicts') || 'Conflits de planning détectés' }}
    </template>
    <template #description>
      <div class="space-y-2">
        <p class="text-sm">
          {{ overlapWarnings.length }} bénévole(s) ont des créneaux qui se chevauchent :
        </p>
        <div class="space-y-1">
          <div
            v-for="warning in overlapWarnings"
            :key="`${warning.volunteerId}-${warning.slot1.id}-${warning.slot2.id}`"
            class="text-sm bg-amber-50 dark:bg-amber-900/20 p-2 rounded border-l-2 border-amber-400"
          >
            <div class="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-200">
              <UiUserAvatar :user="warning.volunteer" size="xs" />
              {{ warning.volunteer.pseudo }}
            </div>
            <div class="text-xs text-amber-700 dark:text-amber-300 mt-1">
              <strong>{{ warning.slot1.title }}</strong>
              <span v-if="warning.slot1.teamName" class="text-amber-600 dark:text-amber-400">
                - {{ warning.slot1.teamName }}</span
              >
              <br />
              ({{ formatDateTimeRange(warning.slot1.start, warning.slot1.end) }})
              <br />
              <strong>{{ warning.slot2.title }}</strong>
              <span v-if="warning.slot2.teamName" class="text-amber-600 dark:text-amber-400">
                - {{ warning.slot2.teamName }}</span
              >
              <br />
              ({{ formatDateTimeRange(warning.slot2.start, warning.slot2.end) }})
            </div>
          </div>
        </div>
      </div>
    </template>
  </UAlert>
</template>

<script setup lang="ts">
interface OverlapWarning {
  volunteerId: number
  volunteer: {
    pseudo: string
    [key: string]: any
  }
  slot1: {
    id: string | number
    title: string
    teamName?: string
    start: string
    end: string
  }
  slot2: {
    id: string | number
    title: string
    teamName?: string
    start: string
    end: string
  }
}

interface Props {
  overlapWarnings: OverlapWarning[]
  canManageVolunteers: boolean
  formatDateTimeRange: (start: string, end: string) => string
}

defineProps<Props>()

// Utilise le hook d'internationalisation
const { t } = useI18n()
</script>
