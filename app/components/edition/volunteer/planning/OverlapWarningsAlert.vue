<template>
  <div v-if="canManageVolunteers" class="space-y-4 mt-6">
    <!-- Alertes de chevauchements -->
    <UAlert
      v-if="overlapWarnings.length > 0"
      color="warning"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
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

    <!-- Alertes de préférences d'équipe -->
    <UAlert
      v-if="preferenceWarnings.length > 0"
      color="info"
      variant="soft"
      icon="i-heroicons-information-circle"
    >
      <template #title>
        {{
          t('editions.volunteers.team_preference_conflicts') || "Conflits de préférences d'équipe"
        }}
      </template>
      <template #description>
        <div class="space-y-2">
          <p class="text-sm">
            {{ preferenceWarnings.length }} assignation(s) ne correspondent pas aux préférences
            d'équipe :
          </p>
          <div class="space-y-1">
            <div
              v-for="warning in preferenceWarnings"
              :key="`${warning.volunteerId}-${warning.slot.id}`"
              class="text-sm bg-blue-50 dark:bg-blue-900/20 p-2 rounded border-l-2 border-blue-400"
            >
              <div class="flex items-center gap-2 font-medium text-blue-800 dark:text-blue-200">
                <UiUserAvatar :user="warning.volunteer" size="xs" />
                {{ warning.volunteer.pseudo }}
              </div>
              <div class="text-xs text-blue-700 dark:text-blue-300 mt-1">
                <strong>{{ warning.slot.title }}</strong>
                <span v-if="warning.teamName" class="text-blue-600 dark:text-blue-400">
                  - {{ warning.teamName }}</span
                >
                <br />
                ({{ formatDateTimeRange(warning.slot.start, warning.slot.end) }})
                <br />
                <span class="text-blue-600 dark:text-blue-400">
                  {{
                    t('editions.volunteers.not_in_team_preferences') ||
                    'Cette équipe ne fait pas partie des préférences du bénévole'
                  }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </UAlert>
  </div>
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

interface PreferenceWarning {
  volunteerId: number
  volunteer: {
    pseudo: string
    [key: string]: any
  }
  slot: {
    id: string | number
    title: string
    teamName?: string
    start: string
    end: string
  }
  teamName: string
}

interface Props {
  overlapWarnings: OverlapWarning[]
  preferenceWarnings: PreferenceWarning[]
  canManageVolunteers: boolean
  formatDateTimeRange: (start: string, end: string) => string
}

defineProps<Props>()

// Utilise le hook d'internationalisation
const { t } = useI18n()
</script>
