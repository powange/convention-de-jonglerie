<template>
  <UCard
    v-if="canManageVolunteers && volunteersStats.totalVolunteers > 0"
    variant="soft"
    class="mt-6"
  >
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold flex items-center gap-2">
          <UIcon name="i-heroicons-user-group" class="text-primary-500" />
          {{ t('editions.volunteers.volunteers_summary') }}
        </h3>
        <UBadge color="primary" variant="soft">
          {{ volunteersStats.totalVolunteers }} {{ t('editions.volunteers.volunteers') }}
        </UBadge>
      </div>
    </template>

    <div class="space-y-4">
      <!-- Résumé global -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div class="text-center">
          <div class="text-2xl font-bold text-primary-600">
            {{ volunteersStats.totalHours.toFixed(1) }}h
          </div>
          <div class="text-sm text-gray-500">{{ t('editions.volunteers.total_hours') }}</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-green-600">
            {{ volunteersStats.averageHours.toFixed(1) }}h
          </div>
          <div class="text-sm text-gray-500">
            {{ t('editions.volunteers.average_per_volunteer') }}
          </div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-600">{{ volunteersStats.totalSlots }}</div>
          <div class="text-sm text-gray-500">
            {{ t('editions.volunteers.total_assignments') }}
          </div>
        </div>
      </div>

      <!-- Onglets pour les statistiques -->
      <UTabs
        :v-model="activeStatsTab"
        :items="[
          {
            key: 'hours-per-volunteer',
            label: 'Heures par bénévoles',
            icon: 'i-heroicons-user-group',
          },
          {
            key: 'hours-per-day',
            label: 'Heures par jour',
            icon: 'i-heroicons-calendar-days',
          },
        ]"
        class="w-full"
      >
        <template #content="{ item }">
          <div v-if="item.key === 'hours-per-day'" class="space-y-3 mt-4">
            <!-- Détail par jour -->
            <div class="space-y-2">
              <div
                v-for="dayStats in volunteersStatsByDay"
                :key="dayStats.date"
                class="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
              >
                <div class="flex items-center justify-between mb-3">
                  <h5 class="font-medium text-gray-900 dark:text-white">
                    {{ formatDate(dayStats.date) }}
                  </h5>
                  <div class="flex items-center gap-2">
                    <UBadge color="neutral" variant="soft" size="sm">
                      {{ dayStats.totalVolunteers }}
                      {{ t('editions.volunteers.volunteers_short') }}
                    </UBadge>
                    <UBadge color="primary" variant="soft" size="sm">
                      {{ dayStats.totalHours.toFixed(1) }}h
                    </UBadge>
                  </div>
                </div>

                <div class="space-y-1">
                  <div
                    v-for="volunteerStat in dayStats.volunteers"
                    :key="`${dayStats.date}-${volunteerStat.user.id}`"
                    class="flex items-center justify-between text-sm"
                  >
                    <div class="flex items-center gap-2">
                      <UiUserAvatar :user="volunteerStat.user" size="xs" />
                      <span class="text-gray-700 dark:text-gray-300">{{
                        volunteerStat.user.pseudo
                      }}</span>
                      <span
                        v-if="volunteerStat.user.prenom || volunteerStat.user.nom"
                        class="text-gray-500 text-xs"
                      >
                        ({{ volunteerStat.user.prenom }} {{ volunteerStat.user.nom }})
                      </span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-gray-600 dark:text-gray-400"
                        >{{ volunteerStat.hours.toFixed(1) }}h</span
                      >
                      <UBadge color="neutral" variant="soft" size="xs">
                        {{ volunteerStat.slots }} {{ t('editions.volunteers.slots_short') }}
                      </UBadge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else-if="item.key === 'hours-per-volunteer'" class="space-y-3 mt-4">
            <!-- Statistiques par bénévole -->
            <div class="space-y-2">
              <div
                v-for="volunteerStat in volunteersStatsIndividual"
                :key="volunteerStat.user.id"
                class="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
              >
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-3">
                    <UiUserAvatar :user="volunteerStat.user" />
                    <div>
                      <h5 class="font-medium text-gray-900 dark:text-white">
                        {{ volunteerStat.user.pseudo }}
                      </h5>
                      <p
                        v-if="volunteerStat.user.prenom || volunteerStat.user.nom"
                        class="text-sm text-gray-500"
                      >
                        {{ volunteerStat.user.prenom }} {{ volunteerStat.user.nom }}
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <UBadge color="primary" variant="soft">
                      {{ volunteerStat.totalHours.toFixed(1) }}h
                    </UBadge>
                    <UBadge color="neutral" variant="soft">
                      {{ volunteerStat.totalSlots }} {{ t('editions.volunteers.slots_short') }}
                    </UBadge>
                  </div>
                </div>

                <!-- Détail par jour pour ce bénévole -->
                <div
                  v-if="volunteerStat.dayDetails && volunteerStat.dayDetails.length > 0"
                  class="space-y-1"
                >
                  <div
                    v-for="dayDetail in volunteerStat.dayDetails"
                    :key="dayDetail.date"
                    class="flex items-center justify-between text-sm"
                  >
                    <div class="flex items-center gap-2">
                      <UIcon name="i-heroicons-calendar" class="text-gray-400" size="14" />
                      <span class="text-gray-700 dark:text-gray-300">
                        {{ formatDate(dayDetail.date) }}
                      </span>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-gray-600 dark:text-gray-400">
                        {{ dayDetail.hours.toFixed(1) }}h
                      </span>
                      <UBadge color="neutral" variant="soft">
                        {{ dayDetail.slots }} {{ t('editions.volunteers.slots_short') }}
                      </UBadge>
                    </div>
                  </div>
                </div>
                <div v-else class="text-sm text-gray-500 italic">
                  Aucun créneau assigné pour le moment
                </div>
              </div>
            </div>
          </div>
        </template>
      </UTabs>
    </div>
  </UCard>
</template>

<script setup lang="ts">
interface VolunteerStats {
  totalVolunteers: number
  totalHours: number
  averageHours: number
  totalSlots: number
}

interface VolunteerStat {
  user: {
    id: number
    pseudo: string
    prenom?: string
    nom?: string
    [key: string]: any
  }
  hours: number
  slots: number
}

interface DayStats {
  date: string
  volunteers: VolunteerStat[]
  totalVolunteers: number
  totalHours: number
}

interface VolunteerStatsIndividual {
  user: {
    id: number
    pseudo: string
    prenom?: string
    nom?: string
    [key: string]: any
  }
  totalHours: number
  totalSlots: number
  dayDetails?: Array<{
    date: string
    hours: number
    slots: number
  }>
}

interface Props {
  canManageVolunteers: boolean
  volunteersStats: VolunteerStats
  volunteersStatsByDay: DayStats[]
  volunteersStatsIndividual: VolunteerStatsIndividual[]
  activeStatsTab: string
  formatDate: (date: string) => string
}

defineProps<Props>()

// Utilise le hook d'internationalisation
const { t } = useI18n()
</script>
