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
          {{ t('volunteers.volunteers_summary') }}
        </h3>
        <UBadge color="primary" variant="soft">
          {{ volunteersStats.totalVolunteers }} {{ t('volunteers.volunteers') }}
        </UBadge>
      </div>
    </template>

    <div class="space-y-4">
      <!-- Résumé global -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <!-- Deux mesures distinctes : ce qui est pourvu, et ce qu'il y a à pourvoir. Les
             afficher côte à côte évite qu'on s'étonne de voir un total plus élevé dans
             l'onglet par équipe. -->
        <div class="text-center">
          <div class="text-2xl font-bold text-primary-600">
            {{ volunteersStats.totalHours.toFixed(1) }}h
            <span class="text-base font-normal text-gray-400">
              / {{ heuresAPourvoir.toFixed(1) }}h
            </span>
          </div>
          <div class="text-sm text-gray-500">{{ t('volunteers.hours_covered_of_needed') }}</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-green-600">
            {{ volunteersStats.averageHours.toFixed(1) }}h
          </div>
          <div class="text-sm text-gray-500">
            {{ t('volunteers.average_per_volunteer') }}
          </div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-600">{{ volunteersStats.totalSlots }}</div>
          <div class="text-sm text-gray-500">
            {{ t('volunteers.total_assignments') }}
          </div>
        </div>
      </div>

      <!-- Sur un écran étroit, les onglets ne tiennent pas côte à côte : un select prend
           le relais. Les deux pilotent le même état, si bien qu'un changement de largeur
           ne fait pas perdre l'onglet en cours. -->
      <USelect
        v-model="ongletActif"
        :items="ongletsPourSelect"
        value-key="value"
        class="w-full sm:hidden"
        :icon="ongletCourant?.icon"
      />

      <UTabs v-model="ongletActif" :items="onglets" class="w-full hidden sm:block" />

      <div>
        <div v-if="ongletActif === 'hours-per-day'" class="space-y-3 mt-4">
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
                    {{ t('volunteers.volunteers_short') }}
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
                      (<UiUserName :user="volunteerStat.user" />)
                    </span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-gray-600 dark:text-gray-400"
                      >{{ volunteerStat.hours.toFixed(1) }}h</span
                    >
                    <UBadge color="neutral" variant="soft" size="xs">
                      {{ volunteerStat.slots }} {{ t('volunteers.slots_short') }}
                    </UBadge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else-if="ongletActif === 'hours-per-volunteer'" class="space-y-3 mt-4">
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
                      <UiUserName :user="volunteerStat.user" />
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <UBadge color="primary" variant="soft">
                    {{ volunteerStat.totalHours.toFixed(1) }}h
                  </UBadge>
                  <UBadge color="neutral" variant="soft">
                    {{ volunteerStat.totalSlots }} {{ t('volunteers.slots_short') }}
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
                      {{ dayDetail.slots }} {{ t('volunteers.slots_short') }}
                    </UBadge>
                  </div>
                </div>
              </div>
              <div v-else class="text-sm text-gray-500 italic">
                {{ t('volunteers.no_slot_assigned_yet') }}
              </div>
            </div>
          </div>
        </div>

        <!-- Heures par équipe -->
        <div v-else-if="ongletActif === 'hours-per-team'" class="space-y-3 mt-4">
          <p v-if="volunteersStatsByTeam.length === 0" class="text-sm text-gray-500 italic">
            {{ t('volunteers.no_slot_assigned_yet') }}
          </p>
          <div
            v-for="equipe in volunteersStatsByTeam"
            :key="equipe.teamId ?? 'sans-equipe'"
            class="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
          >
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h5 class="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                <span
                  v-if="equipe.color"
                  class="inline-block w-3 h-3 rounded-full shrink-0"
                  :style="{ backgroundColor: equipe.color }"
                />
                {{ equipe.teamName }}
              </h5>
              <div class="flex items-center gap-2">
                <UBadge color="primary" variant="soft">
                  {{ equipe.totalHours.toFixed(1) }}h
                </UBadge>
                <UBadge color="neutral" variant="soft">
                  {{ equipe.totalVolunteers }} {{ t('volunteers.volunteers') }}
                </UBadge>
                <UBadge color="neutral" variant="soft">
                  {{ equipe.totalSlots }} {{ t('volunteers.slots_short') }}
                </UBadge>
              </div>
            </div>

            <div class="space-y-1">
              <div
                v-for="detailJour in equipe.dayDetails"
                :key="detailJour.date"
                class="flex items-center justify-between text-sm"
              >
                <div class="flex items-center gap-2">
                  <UIcon name="i-heroicons-calendar" class="text-gray-400 size-3.5" />
                  <span class="text-gray-700 dark:text-gray-300">
                    {{ formatDate(detailJour.date) }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-gray-600 dark:text-gray-400">
                    {{ detailJour.hours.toFixed(1) }}h
                  </span>
                  <UBadge color="neutral" variant="soft">
                    {{ detailJour.slots }} {{ t('volunteers.slots_short') }}
                  </UBadge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
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

interface TeamStats {
  teamId: string | null
  teamName: string
  color?: string
  totalHours: number
  totalSlots: number
  totalVolunteers: number
  dayDetails: Array<{ date: string; hours: number; slots: number }>
}

interface Props {
  canManageVolunteers: boolean
  volunteersStats: VolunteerStats
  volunteersStatsByDay: DayStats[]
  volunteersStatsIndividual: VolunteerStatsIndividual[]
  volunteersStatsByTeam: TeamStats[]
  activeStatsTab?: string
  formatDate: (date: string) => string
}

const props = defineProps<Props>()

// Utilise le hook d'internationalisation
const { t } = useI18n()

const ongletActif = ref(props.activeStatsTab || 'hours-per-volunteer')

// Repris des mêmes données que l'onglet par équipe : les deux chiffres ne peuvent donc pas
// diverger, quelle que soit l'évolution du calcul.
const heuresAPourvoir = computed(() =>
  props.volunteersStatsByTeam.reduce((total, equipe) => total + equipe.totalHours, 0)
)

const onglets = computed(() => [
  {
    value: 'hours-per-volunteer',
    label: t('volunteers.hours_per_volunteer'),
    icon: 'i-heroicons-user-group',
  },
  {
    value: 'hours-per-day',
    label: t('volunteers.hours_per_day'),
    icon: 'i-heroicons-calendar-days',
  },
  {
    value: 'hours-per-team',
    label: t('volunteers.hours_per_team'),
    icon: 'i-heroicons-rectangle-group',
  },
])

// `USelect` n'affiche pas d'icône par option : on ne garde que le libellé
const ongletsPourSelect = computed(() =>
  onglets.value.map(({ value, label }) => ({ value, label }))
)

const ongletCourant = computed(() => onglets.value.find((o) => o.value === ongletActif.value))
</script>
