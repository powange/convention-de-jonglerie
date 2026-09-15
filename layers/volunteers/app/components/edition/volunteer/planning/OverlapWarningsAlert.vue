<template>
  <div v-if="canManageVolunteers" class="space-y-4 mt-6">
    <!-- Alertes de chevauchements -->
    <UAlert
      v-if="overlapWarnings.length > 0"
      color="info"
      variant="soft"
      icon="i-heroicons-exclamation-triangle"
    >
      <template #title>
        {{ t('volunteers.scheduling_conflicts') || 'Conflits de planning détectés' }}
      </template>
      <template #description>
        <UCollapsible v-model:open="chevauchementsDeplies" class="space-y-2">
          <UButton
            variant="ghost"
            color="neutral"
            class="group w-full justify-between p-0 hover:bg-transparent"
            :ui="{
              trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
            }"
            trailing-icon="i-heroicons-chevron-down"
          >
            <span class="text-sm text-left">
              {{ overlapWarnings.length }} bénévole(s) ont des créneaux qui se chevauchent
            </span>
          </UButton>

          <template #content>
            <div class="space-y-1">
              <div
                v-for="warning in overlapWarnings"
                :key="`${warning.volunteerId}-${warning.slot1.id}-${warning.slot2.id}`"
                class="text-sm bg-blue-50 dark:bg-blue-900/20 p-2 rounded border-l-2 border-blue-400"
              >
                <div class="flex items-center gap-2 font-medium text-blue-800 dark:text-blue-200">
                  <UiUserAvatar :user="warning.volunteer" size="xs" />
                  {{ warning.volunteer.pseudo }}
                </div>
                <div class="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  <strong>{{ warning.slot1.title }}</strong>
                  <span v-if="warning.slot1.teamName" class="text-blue-600 dark:text-blue-400">
                    - {{ warning.slot1.teamName }}</span
                  >
                  <br />
                  ({{ formatDateTimeRange(warning.slot1.start, warning.slot1.end) }})
                  <br />
                  <strong>{{ warning.slot2.title }}</strong>
                  <span v-if="warning.slot2.teamName" class="text-blue-600 dark:text-blue-400">
                    - {{ warning.slot2.teamName }}</span
                  >
                  <br />
                  ({{ formatDateTimeRange(warning.slot2.start, warning.slot2.end) }})
                </div>
              </div>
            </div>
          </template>
        </UCollapsible>
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
        {{ t('volunteers.team_preference_conflicts') || "Conflits de préférences d'équipe" }}
      </template>
      <template #description>
        <UCollapsible v-model:open="preferencesDepliees" class="space-y-2">
          <UButton
            variant="ghost"
            color="neutral"
            class="group w-full justify-between p-0 hover:bg-transparent"
            :ui="{
              trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
            }"
            trailing-icon="i-heroicons-chevron-down"
          >
            <span class="text-sm text-left">
              {{ preferenceWarnings.length }} assignation(s) ne correspondent pas aux préférences
              d'équipe
            </span>
          </UButton>

          <template #content>
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
                      t('volunteers.not_in_team_preferences') ||
                      'Cette équipe ne fait pas partie des préférences du bénévole'
                    }}
                  </span>
                </div>
              </div>
            </div>
          </template>
        </UCollapsible>
      </template>
    </UAlert>

    <!-- Alertes de créneaux couvrant les repas -->
    <UAlert
      v-if="mealTimeWarnings.length > 0"
      color="info"
      variant="soft"
      icon="i-heroicons-exclamation-circle"
    >
      <template #title>
        {{ t('volunteers.meal_time_conflicts') || 'Conflits avec les horaires de repas' }}
      </template>
      <template #description>
        <!-- Repliable : la liste peut compter des dizaines de lignes et repousser hors de
             l'écran ce qui la suit. Le décompte reste visible une fois repliée, c'est lui
             qui dit s'il y a lieu de la dérouler. -->
        <UCollapsible v-model:open="repasDeplies" class="space-y-2">
          <UButton
            variant="ghost"
            color="neutral"
            class="group w-full justify-between p-0 hover:bg-transparent"
            :ui="{
              trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
            }"
            trailing-icon="i-heroicons-chevron-down"
          >
            <span class="text-sm text-left">
              {{ mealTimeWarnings.length }} bénévole(s) ont des créneaux qui couvrent entièrement
              une période de repas
            </span>
          </UButton>

          <template #content>
            <div class="space-y-1">
              <div
                v-for="warning in mealTimeWarnings"
                :key="`${warning.volunteerId}-${warning.slot.id}-${warning.mealPeriod}`"
                class="text-sm bg-blue-50 dark:bg-blue-900/20 p-2 rounded border-l-2 border-blue-400"
              >
                <div class="flex items-center gap-2 font-medium text-blue-800 dark:text-blue-200">
                  <UiUserAvatar :user="warning.volunteer" size="xs" />
                  {{ warning.volunteer.pseudo }}
                </div>
                <div class="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  <strong>{{ warning.slot.title }}</strong>
                  <span v-if="warning.slot.teamName" class="text-blue-600 dark:text-blue-400">
                    - {{ warning.slot.teamName }}</span
                  >
                  <br />
                  ({{ formatDateTimeRange(warning.slot.start, warning.slot.end) }})
                  <br />
                  <span class="text-blue-600 dark:text-blue-400">
                    {{
                      warning.mealPeriod === 'lunch'
                        ? t('volunteers.covers_lunch_period') ||
                          'Couvre toute la période du déjeuner (11h30-14h)'
                        : t('volunteers.covers_dinner_period') ||
                          'Couvre toute la période du dîner (19h30-22h)'
                    }}
                  </span>
                </div>
              </div>
            </div>
          </template>
        </UCollapsible>
      </template>
    </UAlert>
    <!-- Spectacles qu'un bénévole ne pourra voir sous aucune de leurs représentations -->
    <UAlert
      v-if="showConflictWarnings.length > 0"
      color="info"
      variant="soft"
      icon="i-heroicons-sparkles"
    >
      <template #title>
        {{ t('volunteers.show_conflicts') }}
      </template>
      <template #description>
        <!-- Repliable comme les conflits de repas : le décompte dit s'il y a lieu de dérouler. -->
        <UCollapsible v-model:open="spectaclesDeplies" class="space-y-2">
          <UButton
            variant="ghost"
            color="neutral"
            class="group w-full justify-between p-0 hover:bg-transparent"
            :ui="{
              trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200',
            }"
            trailing-icon="i-heroicons-chevron-down"
          >
            <span class="text-sm text-left">
              {{ t('volunteers.show_conflicts_count', { count: showConflictWarnings.length }) }}
            </span>
          </UButton>

          <template #content>
            <div class="space-y-1">
              <div
                v-for="warning in showConflictWarnings"
                :key="`${warning.volunteerId}-${warning.show.id}`"
                class="text-sm bg-blue-50 dark:bg-blue-900/20 p-2 rounded border-l-2 border-blue-400"
              >
                <div class="flex items-center gap-2 font-medium text-blue-800 dark:text-blue-200">
                  <UiUserAvatar :user="warning.volunteer" size="xs" />
                  {{ warning.volunteer.pseudo }}
                </div>
                <div class="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  <strong>{{ warning.show.title }}</strong>
                  <br />
                  <span class="text-blue-600 dark:text-blue-400">
                    {{
                      t('volunteers.show_conflicts_detail', {
                        count: warning.representations.length,
                      })
                    }}
                  </span>
                  <!-- Le détail par représentation : sans le créneau qui bloque, l'organisateur
                       ne sait pas quoi déplacer. -->
                  <div
                    v-for="representation in warning.representations"
                    :key="`${representation.startDateTime}-${representation.slot.id}`"
                    class="mt-1"
                  >
                    {{ formatDateTime(representation.startDateTime) }}
                    — <strong>{{ representation.slot.title }}</strong>
                    <span
                      v-if="representation.slot.teamName"
                      class="text-blue-600 dark:text-blue-400"
                    >
                      - {{ representation.slot.teamName }}</span
                    >
                    ({{ formatDateTimeRange(representation.slot.start, representation.slot.end) }})
                  </div>
                </div>
              </div>
            </div>
          </template>
        </UCollapsible>
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

interface MealTimeWarning {
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
  mealPeriod: 'lunch' | 'dinner'
}

interface ShowConflictWarning {
  volunteerId: number
  volunteer: {
    pseudo: string
    [key: string]: any
  }
  show: {
    id: number
    title: string
  }
  representations: Array<{
    startDateTime: string
    slot: {
      id: string | number
      title: string
      start: string
      end: string
      teamName: string | null
    }
  }>
}

interface Props {
  overlapWarnings: OverlapWarning[]
  preferenceWarnings: PreferenceWarning[]
  mealTimeWarnings: MealTimeWarning[]
  showConflictWarnings: ShowConflictWarning[]
  canManageVolunteers: boolean
  formatDateTimeRange: (start: string, end: string) => string
  formatDateTime: (value: string) => string
}

defineProps<Props>()

// Utilise le hook d'internationalisation
const { t } = useI18n()

// Chaque carte a son propre état, replié par défaut : le décompte suffit à savoir s'il y a lieu
// de la dérouler, et une liste entière repoussait hors de l'écran le résumé des bénévoles qui la
// suit. Un état partagé les ouvrirait toutes ensemble, ce qui reproduirait le défaut.
const chevauchementsDeplies = ref(false)
const preferencesDepliees = ref(false)
const repasDeplies = ref(false)
const spectaclesDeplies = ref(false)
</script>
